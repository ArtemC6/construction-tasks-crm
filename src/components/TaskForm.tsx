import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useExecutors } from '../api/profiles';
import { useSites } from '../api/sites';
import type { PersonRef, Site } from '../lib/types';
import { Button, ErrorMessage, Field, inputClass, Loading } from './ui';

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название'),
  description: z.string().trim(),
  siteId: z.string().min(1, 'Выберите объект'),
  assigneeId: z.string().min(1, 'Выберите исполнителя'),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  defaultValues: TaskFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
}

// Сначала загружаем списки объектов и исполнителей, потом показываем форму:
// иначе select получил бы значение по умолчанию раньше, чем свои варианты.
export function TaskForm(props: TaskFormProps) {
  const sites = useSites();
  const executors = useExecutors();

  if (sites.error || executors.error) return <ErrorMessage error={sites.error ?? executors.error} />;
  if (!sites.data || !executors.data) return <Loading />;

  return <TaskFormFields {...props} sites={sites.data} executors={executors.data} />;
}

interface TaskFormFieldsProps extends TaskFormProps {
  sites: Site[];
  executors: PersonRef[];
}

function TaskFormFields({
  defaultValues,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  sites,
  executors,
}: TaskFormFieldsProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Название" error={errors.title?.message}>
        <input className={inputClass} {...register('title')} />
      </Field>
      <Field label="Описание" error={errors.description?.message}>
        <textarea rows={3} className={inputClass} {...register('description')} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Объект" error={errors.siteId?.message}>
          <select className={inputClass} {...register('siteId')}>
            <option value="">— выберите —</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Исполнитель" error={errors.assigneeId?.message}>
          <select className={inputClass} {...register('assigneeId')}>
            <option value="">— выберите —</option>
            {executors.map((executor) => (
              <option key={executor.id} value={executor.id}>
                {executor.full_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorMessage error={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
