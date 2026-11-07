export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('ru-RU');
}
