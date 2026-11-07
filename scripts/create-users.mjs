// Создаёт демо-пользователей через Admin API Supabase.
// Нужен service_role-ключ: он берётся из .env.admin (файл в .gitignore)
// и используется только здесь, на компьютере администратора, — не во фронтенде.
//
// Запуск: npm run seed:users
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD || 'crm-demo-2026';

if (!url || !serviceRoleKey) {
  console.error('Заполните SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.admin (образец — .env.admin.example)');
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Роль постановщика назначает supabase/seed.sql: при создании все — исполнители.
const users = [
  { email: 'manager@example.com', fullName: 'Ирина Петрова' },
  { email: 'worker1@example.com', fullName: 'Алексей Смирнов' },
  { email: 'worker2@example.com', fullName: 'Дмитрий Козлов' },
];

for (const user of users) {
  const { error } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });

  if (!error) {
    console.log(`Создан: ${user.email}`);
  } else if (error.code === 'email_exists' || /already/i.test(error.message)) {
    console.log(`Уже есть: ${user.email}`);
  } else {
    console.error(`Ошибка для ${user.email}: ${error.message}`);
    process.exit(1);
  }
}

console.log('Готово. Теперь выполните supabase/seed.sql в SQL Editor.');
