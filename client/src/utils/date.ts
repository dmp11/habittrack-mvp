export const DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const DAY_LABELS: Record<string, string> = {
  mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс',
};

export const dayLabel = (code: string) => DAY_LABELS[code] || code;

export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat('ru-RU', options || { day: 'numeric', month: 'long' }).format(date);
}

export function dayCode(dateString: string): string {
  return DAY_CODES[(new Date(`${dateString}T12:00:00Z`).getUTCDay() + 6) % 7];
}

export function isScheduled(frequency: string[], dateString: string) {
  return frequency.length === 0 || frequency.includes(dayCode(dateString));
}
