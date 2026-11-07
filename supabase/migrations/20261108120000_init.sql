-- =====================================================================
-- Мини-CRM «Объекты и задачи»: схема, права доступа (RLS), цикл статусов.
-- Все правила доступа живут в базе и работают даже при прямых запросах
-- к Supabase в обход интерфейса.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Типы
-- ---------------------------------------------------------------------
create type public.user_role as enum ('manager', 'executor');

create type public.task_status as enum ('new', 'in_progress', 'review', 'rework', 'accepted');

-- ---------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------

-- Профиль пользователя: имя и роль. Создаётся триггером при добавлении
-- пользователя в auth.users; роль по умолчанию — исполнитель.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'executor',
  created_at timestamptz not null default now()
);

-- Объект (стройка).
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text not null check (length(trim(address)) > 0),
  created_at timestamptz not null default now()
);

-- Задача по объекту.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  assignee_id uuid not null references public.profiles (id),
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index tasks_site_id_idx on public.tasks (site_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

-- История смены статусов. Пишется только функциями базы.
create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status,
  to_status public.task_status not null,
  comment text,
  changed_by uuid not null references public.profiles (id),
  changed_at timestamptz not null default now()
);

create index task_history_task_id_idx on public.task_history (task_id, changed_at);

-- ---------------------------------------------------------------------
-- Вспомогательные функции
-- ---------------------------------------------------------------------

-- Текущий пользователь — постановщик?
-- security definer: читает profiles в обход RLS, иначе политики profiles
-- ссылались бы сами на себя.
create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'manager'
  );
$$;

-- Название статуса по-русски — для понятных сообщений об ошибках.
create function public.task_status_label(p_status public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new' then 'Новая'
    when 'in_progress' then 'В работе'
    when 'review' then 'На проверке'
    when 'rework' then 'На доработке'
    when 'accepted' then 'Принята'
  end;
$$;

-- ---------------------------------------------------------------------
-- Профиль для каждого нового пользователя
-- ---------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Роль из метаданных не берём: её мог бы подставить сам пользователь.
  -- Все новые пользователи — исполнители, постановщика назначает администратор.
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Задачи: проверки при записи
-- ---------------------------------------------------------------------
create function public.tasks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check_assignee boolean;
begin
  if tg_op = 'INSERT' then
    -- Новая задача всегда создаётся в статусе «Новая», автор — тот, кто создаёт.
    new.status := 'new';
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.created_at := now();
    v_check_assignee := true;
  else
    -- Автор и дата создания не меняются.
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    -- Статус меняется только через change_task_status, которая пишет историю.
    if new.status is distinct from old.status
       and coalesce(current_setting('app.status_change', true), '') <> 'on' then
      raise exception 'Статус задачи меняется только через функцию change_task_status';
    end if;
    v_check_assignee := new.assignee_id is distinct from old.assignee_id;
  end if;

  if v_check_assignee and not exists (
    select 1 from public.profiles where id = new.assignee_id and role = 'executor'
  ) then
    raise exception 'Исполнителем можно назначить только пользователя с ролью «Исполнитель»';
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- Первая запись истории: «— → Новая» от автора задачи.
create function public.tasks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_history (task_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.author_id);
  return null;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function public.tasks_after_insert();

-- Записи истории не меняются никем, включая администратора.
create function public.task_history_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Записи истории статусов нельзя изменять';
end;
$$;

create trigger task_history_immutable
  before update on public.task_history
  for each row execute function public.task_history_immutable();

-- ---------------------------------------------------------------------
-- Смена статуса — единственный способ поменять статус задачи
-- ---------------------------------------------------------------------
-- Разрешённые переходы:
--   Новая        → В работе      назначенный исполнитель
--   В работе     → На проверке   назначенный исполнитель
--   На доработке → В работе      назначенный исполнитель
--   На проверке  → Принята       постановщик
--   На проверке  → На доработке  постановщик, комментарий обязателен
create function public.change_task_status(
  p_task_id uuid,
  p_to_status public.task_status,
  p_comment text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_manager boolean := public.is_manager();
  v_comment text := nullif(trim(p_comment), '');
  v_task public.tasks;
  v_from public.task_status;
  v_is_assignee boolean;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'Нужно войти в систему' using errcode = '42501';
  end if;

  -- Блокируем строку: два одновременных запроса не проведут задачу дважды.
  select * into v_task from public.tasks where id = p_task_id for update;

  -- Чужую задачу исполнитель «не видит» — отвечаем так же, как на несуществующую.
  if not found or not (v_is_manager or v_task.assignee_id = v_uid) then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  v_from := v_task.status;
  v_is_assignee := v_task.assignee_id = v_uid;

  v_allowed := case
    when v_from = 'new' and p_to_status = 'in_progress' then v_is_assignee
    when v_from = 'in_progress' and p_to_status = 'review' then v_is_assignee
    when v_from = 'rework' and p_to_status = 'in_progress' then v_is_assignee
    when v_from = 'review' and p_to_status in ('accepted', 'rework') then v_is_manager
    else false
  end;

  if not v_allowed then
    raise exception 'Переход «%» → «%» вам недоступен',
      public.task_status_label(v_from), public.task_status_label(p_to_status)
      using errcode = '42501';
  end if;

  if p_to_status = 'rework' and v_comment is null then
    raise exception 'Чтобы вернуть задачу на доработку, напишите комментарий';
  end if;

  perform set_config('app.status_change', 'on', true);
  update public.tasks set status = p_to_status where id = p_task_id returning * into v_task;
  perform set_config('app.status_change', '', true);

  insert into public.task_history (task_id, from_status, to_status, comment, changed_by)
  values (p_task_id, v_from, p_to_status, v_comment, v_uid);

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------
-- Права на таблицы и функции
-- ---------------------------------------------------------------------
-- Supabase по умолчанию выдаёт anon и authenticated все права на новые
-- таблицы. Забираем их и выдаём только нужное; поверх работает RLS.
revoke all on public.profiles, public.sites, public.tasks, public.task_history from anon, authenticated;

grant select on public.profiles to authenticated;

grant select, delete on public.sites to authenticated;
grant insert (name, address), update (name, address) on public.sites to authenticated;

-- status, author_id и created_at через API не записать: их ставит база.
grant select, delete on public.tasks to authenticated;
grant insert (site_id, title, description, assignee_id),
      update (site_id, title, description, assignee_id)
  on public.tasks to authenticated;

-- Историю через API можно только читать.
grant select on public.task_history to authenticated;

revoke execute on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

revoke execute on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

-- ---------------------------------------------------------------------
-- Политики RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

-- Профили: постановщик видит всех; исполнитель — себя и постановщиков.
-- Изменять профили через API нельзя никому (нет политик и прав на запись).
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or role = 'manager'
    or (select public.is_manager())
  );

-- Объекты: постановщик видит все; исполнитель — только те, где у него есть задачи.
create policy "sites_select" on public.sites
  for select to authenticated
  using (
    (select public.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.site_id = sites.id
        and t.assignee_id = (select auth.uid())
    )
  );

create policy "sites_insert" on public.sites
  for insert to authenticated
  with check ((select public.is_manager()));

create policy "sites_update" on public.sites
  for update to authenticated
  using ((select public.is_manager()))
  with check ((select public.is_manager()));

create policy "sites_delete" on public.sites
  for delete to authenticated
  using ((select public.is_manager()));

-- Задачи: постановщик видит и меняет все; исполнитель только читает свои.
-- Статус исполнитель меняет через change_task_status.
create policy "tasks_select" on public.tasks
  for select to authenticated
  using (
    (select public.is_manager())
    or assignee_id = (select auth.uid())
  );

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check ((select public.is_manager()));

create policy "tasks_update" on public.tasks
  for update to authenticated
  using ((select public.is_manager()))
  with check ((select public.is_manager()));

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using ((select public.is_manager()));

-- История: видна тем, кто видит задачу. Политик на запись нет.
create policy "task_history_select" on public.task_history
  for select to authenticated
  using (
    (select public.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.id = task_history.task_id
        and t.assignee_id = (select auth.uid())
    )
  );
