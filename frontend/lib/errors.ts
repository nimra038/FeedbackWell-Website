import { isAxiosError } from 'axios';
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('. ');
    if (!error.response) return 'Unable to reach the server. Check your connection and try again.';
  }
  return fallback;
}
