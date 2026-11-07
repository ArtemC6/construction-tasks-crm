import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useChangeStatus, useDeleteTask, useSaveTask, useTask, useTaskHistory } from '../api/tasks';
import { useCurrentProfile } from '../auth/AuthProvider';
import { StatusBadge } from '../components/StatusBadge';
import { TaskForm } from '../components/TaskForm';
import { Button, Card, EmptyState, ErrorMessage, inputClass, Loading } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { getAvailableActions, STATUS_LABELS, type StatusAction } from '../lib/status';
import type { Task } from '../lib/types';

export function TaskPage() {
  const { taskId = '' } = useParams();
  const task = useTask(taskId);

  if (task.isPending) return <Loading />;
  if (task.error) return <ErrorMessage error={task.error} />;
  if (!task.data) {
    // Чужую задачу RLS не отдаёт — для исполнителя она «не найдена».
    return <EmptyState>Задача не найдена или у вас нет к ней доступа.</EmptyState>;
  }

  return <TaskDetails task={task.data} />;
}

function TaskDetails({ task }: { task: Task }) {
  const navigate = useNavigate();
  const profile = useCurrentProfile();
  const isManager = profile.role === 'manager';
  const [isEditing, setIsEditing] = useState(false);

  const saveTask = useSaveTask();
  const deleteTask = useDeleteTask();

  const handleDelete = () => {
    if (window.confirm(`Удалить задачу «${task.title}» вместе с историей?`)) {
      deleteTask.mutate(task.id, { onSuccess: () => navigate(`/sites/${task.site_id}`, { replace: true }) });
    }
  };

  return (
    <div className="space-y-6">
      <Link to={`/sites/${task.site_id}`} className="text-sm text-blue-700 hover:underline">
        ← {task.site?.name ?? 'Объект'}
      </Link>

      <Card>
        {isEditing ? (
          <TaskForm
            defaultValues={{
              title: task.title,
              description: task.description,
              siteId: task.site_id,
              assigneeId: task.assignee_id,
            }}
            submitLabel="Сохранить"
            isSubmitting={saveTask.isPending}
            error={saveTask.error}
            onSubmit={(values) => saveTask.mutate({ id: task.id, ...values }, { onSuccess: () => setIsEditing(false) })}
            onCancel={() => {
              saveTask.reset();
              setIsEditing(false);
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-slate-900">{task.title}</h1>
                <StatusBadge status={task.status} />
              </div>
              {isManager && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setIsEditing(true)}>
                    Изменить
                  </Button>
                  <Button variant="danger" onClick={handleDelete} disabled={deleteTask.isPending}>
                    Удалить
                  </Button>
                </div>
              )}
            </div>

            {task.description && <p className="whitespace-pre-line text-slate-700">{task.description}</p>}

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Detail label="Объект" value={task.site?.name} />
              <Detail label="Исполнитель" value={task.assignee?.full_name} />
              <Detail label="Автор" value={task.author?.full_name} />
              <Detail label="Создана" value={formatDateTime(task.created_at)} />
            </dl>
            <ErrorMessage error={deleteTask.error} />
          </div>
        )}
      </Card>

      <StatusActions task={task} />
      <TaskHistory taskId={task.id} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value ?? '—'}</dd>
    </div>
  );
}

// Только те действия, которые доступны текущему пользователю в текущем статусе.
function StatusActions({ task }: { task: Task }) {
  const profile = useCurrentProfile();
  const changeStatus = useChangeStatus();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  const actions = getAvailableActions(task, profile);
  if (actions.length === 0) return null;

  const handleAction = (action: StatusAction) => {
    if (action.requiresComment && !comment.trim()) {
      setCommentError('Напишите, что нужно доработать');
      return;
    }
    setCommentError(null);
    changeStatus.mutate({ taskId: task.id, toStatus: action.to, comment }, { onSuccess: () => setComment('') });
  };

  const commentRequired = actions.some((a) => a.requiresComment);

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold text-slate-900">Действия</h2>
      <label className="block space-y-1">
        <span className="text-sm text-slate-700">
          Комментарий {commentRequired ? '(обязателен при возврате на доработку)' : '(необязательно)'}
        </span>
        <textarea rows={2} className={inputClass} value={comment} onChange={(e) => setComment(e.target.value)} />
        {commentError && <span className="block text-sm text-red-600">{commentError}</span>}
      </label>
      <ErrorMessage error={changeStatus.error} />
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.to}
            variant={action.to === 'rework' ? 'danger' : 'primary'}
            disabled={changeStatus.isPending}
            onClick={() => handleAction(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function TaskHistory({ taskId }: { taskId: string }) {
  const history = useTaskHistory(taskId);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">История</h2>
      {history.isPending && <Loading />}
      <ErrorMessage error={history.error} />
      {history.data && (
        <ol className="space-y-2">
          {history.data.map((entry) => (
            <li key={entry.id} className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-slate-500">{formatDateTime(entry.changed_at)}</span>
                <span className="font-medium text-slate-900">{entry.actor?.full_name ?? '—'}</span>
                <span className="text-slate-700">
                  {entry.from_status
                    ? `${STATUS_LABELS[entry.from_status]} → ${STATUS_LABELS[entry.to_status]}`
                    : `Создал задачу · ${STATUS_LABELS[entry.to_status]}`}
                </span>
              </div>
              {entry.comment && <p className="mt-1 whitespace-pre-line text-slate-700">«{entry.comment}»</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
