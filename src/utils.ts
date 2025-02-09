// Date used by IdoSell is in YYYY-MM-DD HH:MM:SS format
export const formatDateForIdoSell = (
  date: Date | string | null | undefined,
): string => {
  if (!date) return '';

  const d = date instanceof Date ? date : new Date(date);

  // Check if date is valid
  if (isNaN(d.getTime())) return '';

  const pad = (num: number) => num.toString().padStart(2, '0');

  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Utility function to create a delay
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
