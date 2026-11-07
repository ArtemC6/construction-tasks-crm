import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { Task, TaskHistoryEntry, TaskStatus } from '../lib/types';

// У задачи две ссылки на profiles (исполнитель и автор), поэтому связь
// указываем по имени внешнего ключа.
const TASK_COLUMNS = `
  id, site_id, title, description, status, assignee_id, author_id, created_at,
  site:sites(id, name),
  assignee:profiles!tasks_assignee_id_fkey(id, full_name),
  author:profiles!tasks_author_id_fkey(id, full_name)
`;

export function useSiteTasks(siteId: string) {
  return useQuery({
    queryKey: ['tasks', 'site', siteId],
    queryFn: async () =>
      unwrap<Task[]>(
        await supabase.from('tasks').select(TASK_COLUMNS).eq('site_id', siteId).order('created_at'),
      ),
  });
}

export function useMyTasks(userId: string) {
  return useQuery({
    queryKey: ['tasks', 'my', userId],
    queryFn: async () =>
      unwrap<Task[]>(
        await supabase
          .from('tasks')
          .select(TASK_COLUMNS)
          .eq('assignee_id', userId)
          .order('created_at', { ascending: false }),
      ),
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ['tasks', 'one', taskId],
    queryFn: async () =>
      unwrap<Task | null>(await supabase.from('tasks').select(TASK_COLUMNS).eq('id', taskId).maybeSingle()),
  });
}

export function useTaskHistory(taskId: string) {
  return useQuery({
    queryKey: ['task-history', taskId],
    queryFn: async () =>
      unwrap<TaskHistoryEntry[]>(
        await supabase
          .from('task_history')
          .select('id, from_status, to_status, comment, changed_at, actor:profiles!task_history_changed_by_fkey(id, full_name)')
          .eq('task_id', taskId)
          .order('changed_at')
          .order('id'),
      ),
  });
}

export interface SaveTaskInput {
  id?: string;
  title: string;
  description: string;
  siteId: string;
  assigneeId: string;
}

export function useSaveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, description, siteId, assigneeId }: SaveTaskInput) => {
      // status, author_id и created_at не передаём: их ставит база.
      const row = { title, description, site_id: siteId, assignee_id: assigneeId };
      const result = id
        ? await supabase.from('tasks').update(row).eq('id', id).select('id').single()
        : await supabase.from('tasks').insert(row).select('id').single();
      return unwrap<{ id: string }>(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      unwrap(await supabase.from('tasks').delete().eq('id', taskId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export interface ChangeStatusInput {
  taskId: string;
  toStatus: TaskStatus;
  comment: string;
}

// Смена статуса — только через функцию базы: она проверяет переход и пишет историю.
export function useChangeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, toStatus, comment }: ChangeStatusInput) => {
      unwrap(
        await supabase.rpc('change_task_status', {
          p_task_id: taskId,
          p_to_status: toStatus,
          p_comment: comment.trim() || null,
        }),
      );
    },
    onSuccess: (_data, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-history', taskId] });
    },
  });
}
