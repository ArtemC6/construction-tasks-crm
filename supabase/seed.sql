-- =====================================================================
-- Демо-данные: 3 объекта и 7 задач в разных статусах.
-- Запускать в SQL Editor ПОСЛЕ создания пользователей (npm run seed:users)
-- и только на пустой базе.
--
-- Все смены статусов идут через change_task_status от имени нужного
-- пользователя, поэтому проходят те же проверки, что и в приложении,
-- а история заполняется как при обычной работе.
-- =====================================================================

-- Представиться пользователем: auth.uid() читает id из request.jwt.claims.
create or replace function pg_temp.act_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- Сменить статус задачи от имени пользователя.
create or replace function pg_temp.move(
  p_user uuid,
  p_task uuid,
  p_to public.task_status,
  p_comment text default null
)
returns void
language plpgsql
as $$
begin
  perform pg_temp.act_as(p_user);
  perform public.change_task_status(p_task, p_to, p_comment);
end;
$$;

do $$
declare
  v_manager uuid;
  v_worker1 uuid;
  v_worker2 uuid;
  v_site1 uuid;
  v_site2 uuid;
  v_site3 uuid;
  v_task uuid;
begin
  select id into v_manager from public.profiles where email = 'manager@example.com';
  select id into v_worker1 from public.profiles where email = 'worker1@example.com';
  select id into v_worker2 from public.profiles where email = 'worker2@example.com';

  if v_manager is null or v_worker1 is null or v_worker2 is null then
    raise exception 'Не найдены демо-пользователи. Сначала выполните npm run seed:users';
  end if;

  if exists (select 1 from public.sites) then
    raise exception 'В базе уже есть объекты — демо-данные не добавлены';
  end if;

  update public.profiles set role = 'manager' where id = v_manager;

  perform pg_temp.act_as(v_manager);

  insert into public.sites (name, address)
  values ('ЖК «Северный», корпус 2', 'г. Казань, ул. Чистопольская, 64')
  returning id into v_site1;

  insert into public.sites (name, address)
  values ('Частный дом Ивановых', 'Московская обл., д. Бородки, ул. Лесная, 12')
  returning id into v_site2;

  insert into public.sites (name, address)
  values ('Офис на Профсоюзной, ремонт 3 этажа', 'г. Москва, ул. Профсоюзная, 23')
  returning id into v_site3;

  -- ЖК «Северный»: исполнители 1 и 2 ----------------------------------

  perform pg_temp.act_as(v_manager);
  insert into public.tasks (site_id, title, description, assignee_id)
  values (v_site1, 'Залить фундамент секции Б', 'Бетон М300, приёмка по акту скрытых работ.', v_worker1)
  returning id into v_task;
  perform pg_temp.move(v_worker1, v_task, 'in_progress');
  perform pg_temp.move(v_worker1, v_task, 'review', 'Залито, фото и акт приложил в чат');
  perform pg_temp.move(v_manager, v_task, 'accepted', 'Принято, спасибо');

  perform pg_temp.act_as(v_manager);
  insert into public.tasks (site_id, title, description, assignee_id)
  values (v_site1, 'Монтаж опалубки 3 этажа', 'Опалубка перекрытия, проверить уровень.', v_worker1)
  returning id into v_task;
  perform pg_temp.move(v_worker1, v_task, 'in_progress');
  perform pg_temp.move(v_worker1, v_task, 'review');

  perform pg_temp.act_as(v_manager);
  insert into public.tasks (site_id, title, description, assignee_id)
  values (v_site1, 'Гидроизоляция подвала', 'Обмазочная гидроизоляция в два слоя.', v_worker2)
  returning id into v_task;
  perform pg_temp.move(v_worker2, v_task, 'in_progress');
  perform pg_temp.move(v_worker2, v_task, 'review');
  perform pg_temp.move(v_manager, v_task, 'rework', 'Второй слой не по всей стене — пропуски у северного угла');
  perform pg_temp.move(v_worker2, v_task, 'in_progress', 'Доделываю');

  -- Дом Ивановых: только исполнитель 2 --------------------------------

  perform pg_temp.act_as(v_manager);
  insert into public.tasks (site_id, title, description, assignee_id)
  values (v_site2, 'Кладка стен первого этажа', 'Газобетон 300 мм, армирование каждого 4-го ряда.', v_worker2)
  returning id into v_task;
  perform pg_temp.move(v_worker2, v_task, 'in_progress');

  perform pg_temp.act_as(v_manager);
  insert into public.tasks (site_id, title, description, assignee_id)
  values (v_site2, 'Принять кирпич для облицовки', 'Проверить количество и бой при разгрузке.', v_worker2);

  -- Офис на Профсоюзной: только исполнитель 1 -------------------------

  perform pg_temp.act_as(v_manager);
  insert into public.tasks (site_id, title, description, assignee_id)
  values (v_site3, 'Демонтаж перегородок', 'Перегородки по плану, мусор — в контейнер во дворе.', v_worker1)
  returning id into v_task;
  perform pg_temp.move(v_worker1, v_task, 'in_progress');
  perform pg_temp.move(v_worker1, v_task, 'review');
  perform pg_temp.move(v_manager, v_task, 'rework', 'Осталась перегородка в переговорной, она тоже по плану');

  perform pg_temp.act_as(v_manager);
  insert into public.tasks (site_id, title, description, assignee_id)
  values (v_site3, 'Разводка электрики', 'По проекту ЭО-3, кабель ВВГнг-LS.', v_worker1);
end;
$$;
