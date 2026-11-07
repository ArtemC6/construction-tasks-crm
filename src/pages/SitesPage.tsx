import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSaveSite, useSites } from '../api/sites';
import { useCurrentProfile } from '../auth/AuthProvider';
import { SiteForm } from '../components/SiteForm';
import { Button, Card, EmptyState, ErrorMessage, Loading } from '../components/ui';

export function SitesPage() {
  const profile = useCurrentProfile();
  const isManager = profile.role === 'manager';
  const sites = useSites();
  const saveSite = useSaveSite();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Объекты</h1>
          {!isManager && <p className="text-sm text-slate-500">Объекты, где у вас есть задачи</p>}
        </div>
        {isManager && !isCreating && <Button onClick={() => setIsCreating(true)}>Добавить объект</Button>}
      </div>

      {isCreating && (
        <Card>
          <h2 className="mb-3 font-medium">Новый объект</h2>
          <SiteForm
            submitLabel="Создать"
            isSubmitting={saveSite.isPending}
            error={saveSite.error}
            onSubmit={(values) => saveSite.mutate(values, { onSuccess: () => setIsCreating(false) })}
            onCancel={() => {
              saveSite.reset();
              setIsCreating(false);
            }}
          />
        </Card>
      )}

      {sites.isPending && <Loading />}
      <ErrorMessage error={sites.error} />

      {sites.data?.length === 0 && (
        <EmptyState>{isManager ? 'Объектов пока нет — добавьте первый.' : 'Вам пока не назначено ни одной задачи.'}</EmptyState>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {sites.data?.map((site) => (
          <Link key={site.id} to={`/sites/${site.id}`} className="block">
            <Card className="h-full transition hover:border-blue-300">
              <p className="font-medium text-slate-900">{site.name}</p>
              <p className="text-sm text-slate-500">{site.address}</p>
              <p className="mt-2 text-sm text-slate-600">
                {isManager ? 'Задач' : 'Ваших задач'}: {site.tasks.length}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
