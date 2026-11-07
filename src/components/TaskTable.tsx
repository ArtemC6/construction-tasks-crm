import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format';
import type { Task } from '../lib/types';
import { StatusBadge } from './StatusBadge';

interface TaskTableProps {
  tasks: Task[];
  showSite?: boolean;
}

export function TaskTable({ tasks, showSite = false }: TaskTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2 font-medium">Задача</th>
            {showSite && <th className="px-4 py-2 font-medium">Объект</th>}
            <th className="px-4 py-2 font-medium">Исполнитель</th>
            <th className="px-4 py-2 font-medium">Статус</th>
            <th className="px-4 py-2 font-medium">Создана</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-slate-50">
              <td className="px-4 py-2">
                <Link to={`/tasks/${task.id}`} className="font-medium text-blue-700 hover:underline">
                  {task.title}
                </Link>
              </td>
              {showSite && <td className="px-4 py-2 text-slate-700">{task.site?.name ?? '—'}</td>}
              <td className="px-4 py-2 text-slate-700">{task.assignee?.full_name ?? '—'}</td>
              <td className="px-4 py-2">
                <StatusBadge status={task.status} />
              </td>
              <td className="px-4 py-2 text-slate-500">{formatDate(task.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
