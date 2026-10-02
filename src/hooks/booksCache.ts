import type { QueryClient } from '@tanstack/react-query';

import { removeBookById, upsertBook } from '@/lib/bookList';
import { normalizeBook, type BookRow } from '@/lib/normalizeBook';
import { supabase } from '@/lib/supabase';
import type { Book } from '@/types/book';

// The library list is the heaviest read in the app, so a change to one book
// patches that one row into the cache. Refetching the list on every write - or
// on every realtime echo - re-downloaded the whole shelf each time.

export function booksQueryKey(userId: string | undefined) {
  return ['books', userId] as const;
}

/** A row the caller already holds (an insert returns it), slotted into the cache. */
export function patchBook(queryClient: QueryClient, userId: string, book: Book) {
  queryClient.setQueryData<Book[]>(booksQueryKey(userId), (list) => (list ? upsertBook(list, book) : list));
}

export function dropBook(queryClient: QueryClient, userId: string, id: string) {
  queryClient.setQueryData<Book[]>(booksQueryKey(userId), (list) => (list ? removeBookById(list, id) : list));
}

/** One book, fetched on its own. */
async function fetchBookRow(id: string): Promise<Book | null> {
  const { data, error } = await supabase.from('books').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalizeBook(data as BookRow) : null;
}

const running = new Map<string, Promise<void>>();
const stale = new Set<string>();

/**
 * Re-reads one book into the cached list. Never rejects: if the single read
 * fails the whole list is invalidated instead, which is the old (costly) path
 * but still correct.
 *
 * A call that lands while the same book is already being read marks it stale
 * and reads once more afterwards - the in-flight read may predate that write.
 */
export function refreshBook(queryClient: QueryClient, userId: string, id: string): Promise<void> {
  const key = `${userId}:${id}`;
  const active = running.get(key);
  if (active) {
    stale.add(key);
    return active;
  }

  const task = fetchBookRow(id)
    .then((book) => {
      if (!book) return dropBook(queryClient, userId, id);
      patchBook(queryClient, userId, book);
    })
    .catch(() => {
      queryClient.invalidateQueries({ queryKey: booksQueryKey(userId) });
    })
    .finally(() => {
      running.delete(key);
      if (stale.delete(key)) void refreshBook(queryClient, userId, id);
    });
  running.set(key, task);
  return task;
}
