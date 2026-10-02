import { useLibraryRealtime } from '@/hooks/useLibraryRealtime';

// Renders nothing; mounted once from the root layout so the library has exactly
// one realtime channel however many screens read it.
export function LibrarySync() {
  useLibraryRealtime();
  return null;
}
