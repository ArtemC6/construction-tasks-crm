export type UserRole = 'manager' | 'executor';

export type TaskStatus = 'new' | 'in_progress' | 'review' | 'rework' | 'accepted';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

export interface PersonRef {
  id: string;
  full_name: string;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  created_at: string;
}

export interface SiteWithTasks extends Site {
  // Только задачи, которые видит текущий пользователь (RLS).
  tasks: { id: string }[];
}

export interface Task {
  id: string;
  site_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee_id: string;
  author_id: string;
  created_at: string;
  site: { id: string; name: string } | null;
  assignee: PersonRef | null;
  author: PersonRef | null;
}

export interface TaskHistoryEntry {
  id: number;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  comment: string | null;
  changed_at: string;
  // null, если исполнитель не видит профиль автора записи
  // (например, прежнего исполнителя после переназначения).
  actor: PersonRef | null;
}
