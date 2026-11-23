import type { TFunction } from 'i18next';

export const getKffLocale = (language: string) =>
  language === 'ar' ? 'ar' : 'en-US';

export const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "2026-11-23" in local time — the incidents search date format. */
export const toKffDateParam = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// "Nov 2, Mon 11:26 AM"
export const formatKffDateTime = (value: string | Date, language: string) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const locale = getKffLocale(language);
  const monthDay = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const weekday = date.toLocaleDateString(locale, { weekday: 'short' });
  const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  return `${monthDay}, ${weekday} ${time}`;
};

// "44 minutes ago" / "3 hours ago" / "2 days ago"
export const formatKffRelativeTime = (value: string | Date, t: TFunction) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return t('kff.time.justNow');
  if (minutes < 60) return t('kff.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('kff.time.hoursAgo', { count: hours });
  return t('kff.time.daysAgo', { count: Math.floor(hours / 24) });
};
