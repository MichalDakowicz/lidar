import { useQuery } from '@tanstack/react-query';

import { useBookRatings } from '@/hooks/useBookRatings';
import { useBooks } from '@/hooks/useBooks';
import { supabase } from '@/lib/supabase';
import type { BookActivityEvent, BookActivityType } from '@/types/book';

type ActivityRow = {
  id: string;
  user_id: string;
  book_id: string | null;
  book_key: string | null;
  book_title: string;
  type: BookActivityType;
  details: Record<string, unknown> | null;
  created_at: string;
};

/**
 * One activity row, fetched by id rather than found in the feed's page: the
 * thread is a deep-linkable route, so it has to stand up when the feed was
 * never loaded (a shared URL, a cold start).
 *
 * The artwork is looked up locally by release key — an activity row only stores
 * a title, because it has to survive the book being deleted.
 */
export function useActivityDetail(activityId: string | undefined) {
  const { books } = useBooks();
  const { ratings } = useBookRatings();

  const query = useQuery({
    queryKey: ['bookActivity', 'one', activityId],
    queryFn: async (): Promise<BookActivityEvent | null> => {
      const { data, error } = await supabase.from('book_activity').select('*').eq('id', activityId!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as ActivityRow;
      return {
        id: row.id,
        userId: row.user_id,
        bookId: row.book_id,
        bookKey: row.book_key,
        bookTitle: row.book_title,
        type: row.type,
        details: row.details ?? {},
        createdAt: row.created_at,
      };
    },
    enabled: !!activityId,
  });

  const event = query.data ?? null;
  const key = event?.bookKey;
  const coverUrl =
    (key ? books.find((book) => book.bookKey === key)?.coverUrl : null) ??
    (key ? ratings.find((rating) => rating.bookKey === key)?.coverUrl : null) ??
    null;

  return { event, coverUrl, loading: query.isLoading, error: query.error };
}
