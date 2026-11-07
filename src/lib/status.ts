import type { Profile, Task, TaskStatus, UserRole } from './types';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  rework: 'На доработке',
  accepted: 'Принята',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Постановщик',
  executor: 'Исполнитель',
};

export interface StatusAction {
  to: TaskStatus;
  label: string;
  requiresComment: boolean;
}

interface Transition {
  from: TaskStatus;
  to: TaskStatus;
  by: 'manager' | 'assignee';
  label: string;
}

// Повторяет правила функции change_task_status в базе. Здесь — только чтобы
// показать нужные кнопки; решает всё равно база.
const TRANSITIONS: Transition[] = [
  { from: 'new', to: 'in_progress', by: 'assignee', label: 'Взять в работу' },
  { from: 'in_progress', to: 'review', by: 'assignee', label: 'Отправить на проверку' },
  { from: 'rework', to: 'in_progress', by: 'assignee', label: 'Взять в работу' },
  { from: 'review', to: 'accepted', by: 'manager', label: 'Принять' },
  { from: 'review', to: 'rework', by: 'manager', label: 'Вернуть на доработку' },
];

export function getAvailableActions(
  task: Pick<Task, 'status' | 'assignee_id'>,
  user: Pick<Profile, 'id' | 'role'>,
): StatusAction[] {
  return TRANSITIONS.filter(
    (t) =>
      t.from === task.status &&
      (t.by === 'manager' ? user.role === 'manager' : task.assignee_id === user.id),
  ).map(({ to, label }) => ({ to, label, requiresComment: to === 'rework' }));
}
