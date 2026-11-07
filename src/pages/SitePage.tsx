import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteSite, useSaveSite, useSite } from '../api/sites';
import { useSaveTask, useSiteTasks } from '../api/tasks';
import { useCurrentProfile } from '../auth/AuthProvider';
import { SiteForm } from '../components/SiteForm';
import { TaskForm } from '../components/TaskForm';
import { TaskTable } from '../components/TaskTable';
import { Button, Card, EmptyState, ErrorMessage, Loading } from '../components/ui';

export function SitePage() {
  const { siteId = '' } = useParams();
  const navigate = useNavigate();
  const profile = useCurrentProfile();
  const isManager = profile.role === 'manager';

  const site = useSite(siteId);
  const tasks = useSiteTasks(siteId);
  const saveSite = useSaveSite();
  const deleteSite = useDeleteSite();
  const saveTask = useSaveTask();

  const [isEditingSite, setIsEditingSite] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  if (site.isPending) return <Loading />;
  if (site.error) return <ErrorMessage error={site.error} />;
  if (!site.data) {
    // RLS не отдаёт объект, к которому нет доступа, — для пользователя это «не найден».
    return (
      <div className="space-y-3">
        <EmptyState>Объект не найден или у вас нет к нему доступа.</EmptyState>
        <Link to="/sites" className="text-sm text-blue-700 hover:underline">
          ← К списку объектов
        </Link>
      </div>
    );
  }

  const currentSite = site.data;

  const handleDelete = () => {
    if (window.confirm(`Удалить объект «${currentSite.name}» вместе со всеми задачами и их историей?`)) {
      deleteSite.mutate(currentSite.id, { onSuccess: () => navigate('/sites', { replace: true }) });
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/sites" className="text-sm text-blue-700 hover:underline">
        ← Объекты
      </Link>

      <Card>
        {isEditingSite ? (
          <SiteForm
            defaultValues={{ name: currentSite.name, address: currentSite.address }}
            submitLabel="Сохранить"
            isSubmitting={saveSite.isPending}
            error={saveSite.error}
            onSubmit={(values) =>
              saveSite.mutate({ id: currentSite.id, ...values }, { onSuccess: () => setIsEditingSite(false) })
            }
            onCancel={() => {
              saveSite.reset();
              setIsEditingSite(false);
            }}
          />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{currentSite.name}</h1>
              <p className="text-slate-500">{currentSite.address}</p>
            </div>
            {isManager && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsEditingSite(true)}>
                  Изменить
                </Button>
                <Button variant="danger" onClick={handleDelete} disabled={deleteSite.isPending}>
                  Удалить
                </Button>
              </div>
            )}
          </div>
        )}
        <div className="mt-2">
          <ErrorMessage error={deleteSite.error} />
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{isManager ? 'Задачи' : 'Ваши задачи на объекте'}</h2>
          {isManager && !isCreatingTask && <Button onClick={() => setIsCreatingTask(true)}>Новая задача</Button>}
        </div>

        {isCreatingTask && (
          <Card>
            <h3 className="mb-3 font-medium">Новая задача</h3>
            <TaskForm
              defaultValues={{ title: '', description: '', siteId: currentSite.id, assigneeId: '' }}
              submitLabel="Создать"
              isSubmitting={saveTask.isPending}
              error={saveTask.error}
              onSubmit={(values) => saveTask.mutate(values, { onSuccess: () => setIsCreatingTask(false) })}
              onCancel={() => {
                saveTask.reset();
                setIsCreatingTask(false);
              }}
            />
          </Card>
        )}

        {tasks.isPending && <Loading />}
        <ErrorMessage error={tasks.error} />
        {tasks.data?.length === 0 && <EmptyState>Задач по объекту пока нет.</EmptyState>}
        {tasks.data && tasks.data.length > 0 && <TaskTable tasks={tasks.data} />}
      </section>
    </div>
  );
}
