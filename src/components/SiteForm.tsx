import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, ErrorMessage, Field, inputClass } from './ui';

const siteSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название'),
  address: z.string().trim().min(1, 'Укажите адрес'),
});

export type SiteFormValues = z.infer<typeof siteSchema>;

interface SiteFormProps {
  defaultValues?: SiteFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (values: SiteFormValues) => void;
  onCancel: () => void;
}

export function SiteForm({ defaultValues, submitLabel, isSubmitting, error, onSubmit, onCancel }: SiteFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SiteFormValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: defaultValues ?? { name: '', address: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Название" error={errors.name?.message}>
        <input className={inputClass} {...register('name')} />
      </Field>
      <Field label="Адрес" error={errors.address?.message}>
        <input className={inputClass} {...register('address')} />
      </Field>
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
