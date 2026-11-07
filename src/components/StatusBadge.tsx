import { STATUS_LABELS } from '../lib/status';
import type { TaskStatus } from '../lib/types';

const colors: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-amber-100 text-amber-800',
  rework: 'bg-red-100 text-red-800',
  accepted: 'bg-green-100 text-green-800',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
