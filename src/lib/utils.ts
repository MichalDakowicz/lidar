import { type ClassValue, clsx } from 'clsx';
import type { useRouter } from 'expo-router';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Deep-linked/direct-nav screens (book detail, release detail) have no back
// history — fall back to the library instead of a no-op back().
export function goBackOrHome(router: ReturnType<typeof useRouter>): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function formatRelativeTime(timestamp: string | number | null | undefined): string | null {
  if (!timestamp) return null;

  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (!Number.isFinite(time)) return null;
  const diff = Date.now() - time;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(time).toLocaleDateString();
}

/** Authors as one line. A book can credit several, and the card shows all. */
export function authorsToDisplayString(authors: string[] | null | undefined): string {
  return (authors ?? []).filter(Boolean).join(', ');
}

/**
 * The year alone, whatever precision the date came at — Google Books hands back
 * '1969', '1969-08' and '1969-08-08' for different editions.
 */
export function publishedYear(publishedDate: string | null | undefined): string {
  return publishedDate ? publishedDate.slice(0, 4) : '';
}

/** Full date when the precision supports one, else whatever is known. */
export function formatPublishedDate(publishedDate: string | null | undefined, precision?: string | null): string {
  if (!publishedDate) return '';
  if (precision === 'year' || publishedDate.length === 4) return publishedDate;
  const date = new Date(publishedDate);
  if (Number.isNaN(date.getTime())) return publishedDate;
  if (precision === 'month' || publishedDate.length === 7) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Money as typed, without pretending to know the user's currency. */
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '';
  return price.toFixed(2).replace(/\.00$/, '');
}
