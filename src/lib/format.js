const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatDate(date) {
  try {
    return dateFormat.format(date);
  } catch {
    return '';
  }
}
