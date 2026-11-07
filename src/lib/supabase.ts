import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY — см. README');
}

// Во фронтенде только публичный anon-ключ: всё, что можно пользователю,
// решают права и политики RLS в базе.
export const supabase = createClient(url, anonKey);

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

// Достаёт данные из ответа Supabase или бросает понятную ошибку.
export function unwrap<T>(result: QueryResult): T {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data as T;
}
