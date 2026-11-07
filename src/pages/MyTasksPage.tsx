import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMyTasks } from '../api/tasks';
import { useCurrentProfile } from '../auth/AuthProvider';
import { TaskTable } from '../components/TaskTable';
import { EmptyState, ErrorMessage, inputClass, Loading } from '../components/ui';
import { STATUS_LABELS } from '../lib/status';
import type { TaskStatus } from '../lib/types';

type StatusFilter = TaskStatus | 'all';

const filterOptions = Object.entries(STATUS_LABELS) as [TaskStatus, string][];

export function MyTasksPage() {
  const profile = useCurrentProfile();
  const tasks = useMyTasks(profile.id);
  const [filter, setFilter] = useState<StatusFilter>('all');

  // Экран исполнителя; постановщик работает через список объектов.
  if (profile.role !== 'executor') {
    return <Navigate to="/sites" replace />;
  }

  const visibleTasks = tasks.data?.filter((t) => filter === 'all' || t.status === filter) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Мои задачи</h1>
        <select
          className={`${inputClass} w-auto`}
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
        >
          <option value="all">Все статусы</option>
          {filterOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {tasks.isPending && <Loading />}
      <ErrorMessage error={tasks.error} />
      {tasks.data && visibleTasks.length === 0 && <EmptyState>Задач нет.</EmptyState>}
      {visibleTasks.length > 0 && <TaskTable tasks={visibleTasks} showSite />}
    </div>
  );
}
