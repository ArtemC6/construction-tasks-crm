import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, ErrorMessage, Field, inputClass } from '../components/ui';
import { supabase } from '../lib/supabase';

const loginSchema = z.object({
  email: z.string().trim().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { session } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  // После входа сессия появится в AuthProvider, и мы уйдём на главную.
  if (session) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: LoginValues) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setAuthError(error.message === 'Invalid login credentials' ? 'Неверный email или пароль' : error.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Объекты и задачи</h1>
        <p className="mb-4 text-sm text-slate-500">Вход для сотрудников. Доступ выдаёт администратор.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Email" error={errors.email?.message}>
            <input type="email" autoComplete="username" className={inputClass} {...register('email')} />
          </Field>
          <Field label="Пароль" error={errors.password?.message}>
            <input type="password" autoComplete="current-password" className={inputClass} {...register('password')} />
          </Field>
          <ErrorMessage error={authError} />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Входим…' : 'Войти'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
