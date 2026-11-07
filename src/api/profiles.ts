import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { PersonRef, Profile } from '../lib/types';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  return unwrap<Profile | null>(
    await supabase.from('profiles').select('id, email, full_name, role').eq('id', userId).maybeSingle(),
  );
}

// Список исполнителей для назначения. Нужен только постановщику.
export function useExecutors() {
  return useQuery({
    queryKey: ['executors'],
    queryFn: async () =>
      unwrap<PersonRef[]>(
        await supabase.from('profiles').select('id, full_name').eq('role', 'executor').order('full_name'),
      ),
  });
}
