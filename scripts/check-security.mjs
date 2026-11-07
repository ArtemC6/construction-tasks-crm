// Проверка правил доступа «в обход интерфейса»: обращается к Supabase
// напрямую с публичным anon-ключом, входит под демо-пользователями
// и пробует то, что им запрещено. Данные не меняет, если защита работает.
//
// Запуск (после seed.sql): npm run check:security
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD || 'crm-demo-2026';

if (!url || !anonKey) {
  console.error('Заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local');
  process.exit(1);
}

const newClient = () =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(email) {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Не удалось войти как ${email}: ${error.message}`);
  return { client, userId: data.user.id };
}

let failed = 0;

function report(ok, title, details = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${title}${!ok && details ? ` — ${details}` : ''}`);
  if (!ok) failed += 1;
}

// Запись заблокирована, если база вернула ошибку или не изменила ни одной строки.
const blocked = ({ data, error }) => Boolean(error) || !data || data.length === 0;
// Вызов функции заблокирован, если база вернула ошибку.
const rejected = ({ error }) => Boolean(error);

const anon = newClient();
const manager = await signIn('manager@example.com');
const worker1 = await signIn('worker1@example.com');
const worker2 = await signIn('worker2@example.com');

const { data: allTasks, error: tasksError } = await manager.client
  .from('tasks')
  .select('id, site_id, status, assignee_id');
if (tasksError) throw new Error(tasksError.message);

const worker1Task = allTasks.find((t) => t.assignee_id === worker1.userId);
const worker2Task = allTasks.find((t) => t.assignee_id === worker2.userId);
if (!worker1Task || !worker2Task) {
  throw new Error('Нет демо-задач: выполните supabase/seed.sql');
}

// --- Чтение -----------------------------------------------------------

{
  const { data, error } = await anon.from('tasks').select('id');
  report(Boolean(error) || data.length === 0, 'Без входа задачи не видны');
}

{
  const { data, error } = await worker2.client.from('tasks').select('id, assignee_id');
  report(
    !error && data.length > 0 && data.every((t) => t.assignee_id === worker2.userId),
    'Исполнитель видит только свои задачи',
    error?.message,
  );
}

{
  const { data } = await worker2.client.from('tasks').select('id').eq('id', worker1Task.id);
  report((data ?? []).length === 0, 'Чужую задачу нельзя прочитать даже по id');
}

{
  const { data } = await worker2.client.from('task_history').select('id').eq('task_id', worker1Task.id);
  report((data ?? []).length === 0, 'История чужой задачи не видна');
}

{
  const ownSiteIds = new Set(
    allTasks.filter((t) => t.assignee_id === worker2.userId).map((t) => t.site_id),
  );
  const { data, error } = await worker2.client.from('sites').select('id');
  report(
    !error && data.length === ownSiteIds.size && data.every((s) => ownSiteIds.has(s.id)),
    'Исполнитель видит только объекты, где у него есть задачи',
    error?.message,
  );
}

// --- Запись задач и объектов ------------------------------------------

report(
  blocked(await worker2.client.from('tasks').update({ title: 'Подмена' }).eq('id', worker1Task.id).select('id')),
  'Чужую задачу нельзя изменить',
);

report(
  blocked(await worker2.client.from('tasks').update({ title: 'Подмена' }).eq('id', worker2Task.id).select('id')),
  'Исполнитель не может редактировать поля своей задачи',
);

report(
  blocked(await worker2.client.from('tasks').update({ status: 'accepted' }).eq('id', worker2Task.id).select('id')),
  'Статус нельзя поменять прямым UPDATE, минуя проверку переходов',
);

report(
  blocked(await worker2.client.from('tasks').delete().eq('id', worker2Task.id).select('id')),
  'Исполнитель не может удалить задачу',
);

report(
  blocked(
    await worker2.client
      .from('tasks')
      .insert({ site_id: worker2Task.site_id, title: 'Своя задача', assignee_id: worker2.userId })
      .select('id'),
  ),
  'Исполнитель не может создать задачу',
);

report(
  blocked(await worker2.client.from('sites').insert({ name: 'Объект', address: 'Адрес' }).select('id')),
  'Исполнитель не может создать объект',
);

report(
  blocked(await worker2.client.from('profiles').update({ role: 'manager' }).eq('id', worker2.userId).select('id')),
  'Исполнитель не может назначить себе роль постановщика',
);

// --- Переходы статусов --------------------------------------------------

report(
  rejected(await worker2.client.rpc('change_task_status', { p_task_id: worker1Task.id, p_to_status: 'in_progress' })),
  'Нельзя сменить статус чужой задачи',
);

report(
  rejected(await worker2.client.rpc('change_task_status', { p_task_id: worker2Task.id, p_to_status: 'accepted' })),
  'Исполнитель не может сам принять задачу',
);

const newTask = allTasks.find((t) => t.status === 'new');
if (newTask) {
  const assignee = [worker1, worker2].find((w) => w.userId === newTask.assignee_id);
  report(
    rejected(await assignee.client.rpc('change_task_status', { p_task_id: newTask.id, p_to_status: 'review' })),
    'Нельзя перескочить статус: «Новая» → «На проверке»',
  );
  report(
    rejected(await manager.client.rpc('change_task_status', { p_task_id: newTask.id, p_to_status: 'in_progress' })),
    'Постановщик не может взять задачу в работу за исполнителя',
  );
}

const reviewTask = allTasks.find((t) => t.status === 'review');
if (reviewTask) {
  report(
    rejected(
      await manager.client.rpc('change_task_status', {
        p_task_id: reviewTask.id,
        p_to_status: 'rework',
        p_comment: '   ',
      }),
    ),
    'Возврат на доработку без комментария не проходит',
  );
}

// --- История ------------------------------------------------------------

report(
  rejected(
    await worker2.client
      .from('task_history')
      .insert({ task_id: worker2Task.id, to_status: 'accepted', changed_by: worker2.userId }),
  ),
  'В историю нельзя добавить запись вручную',
);

report(
  blocked(await manager.client.from('task_history').update({ comment: 'Подделка' }).eq('task_id', worker1Task.id).select('id')),
  'Историю нельзя изменить даже постановщику',
);

report(
  blocked(await manager.client.from('task_history').delete().eq('task_id', worker1Task.id).select('id')),
  'Историю нельзя удалить даже постановщику',
);

// --- Регистрация --------------------------------------------------------

{
  const { data, error } = await anon.auth.signUp({
    email: `probe-${Date.now()}@example.com`,
    password: 'probe-password-2026',
  });
  report(
    Boolean(error),
    'Открытая регистрация отключена',
    data?.user ? `создан ${data.user.email}: удалите его и выключите регистрацию в настройках Auth` : '',
  );
}

console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nНе пройдено проверок: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
