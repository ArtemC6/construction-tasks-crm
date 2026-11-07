import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { Site, SiteWithTasks } from '../lib/types';

// RLS сам отдаёт исполнителю только объекты с его задачами — фильтр в запросе не нужен.
export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () =>
      unwrap<SiteWithTasks[]>(
        await supabase.from('sites').select('id, name, address, created_at, tasks(id)').order('created_at'),
      ),
  });
}

export function useSite(siteId: string) {
  return useQuery({
    queryKey: ['sites', siteId],
    queryFn: async () =>
      unwrap<Site | null>(
        await supabase.from('sites').select('id, name, address, created_at').eq('id', siteId).maybeSingle(),
      ),
  });
}

export interface SaveSiteInput {
  id?: string;
  name: string;
  address: string;
}

export function useSaveSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, address }: SaveSiteInput) => {
      const row = { name, address };
      const result = id
        ? await supabase.from('sites').update(row).eq('id', id).select('id').single()
        : await supabase.from('sites').insert(row).select('id').single();
      return unwrap<{ id: string }>(result);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] }),
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (siteId: string) => {
      unwrap(await supabase.from('sites').delete().eq('id', siteId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
