import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { normalizeRating, type BookRatingRow } from '@/lib/normalizeBook';
import { personalScore } from '@/lib/personalScore';
import { isEmptyRatings } from '@/lib/ratings';
import { stripUndefined } from '@/lib/stripUndefined';
import { supabase } from '@/lib/supabase';
import type { BookRating, Ratings } from '@/types/book';

function ratingsQueryKey(userId: string | undefined) {
  return ['bookRatings', userId] as const;
}

async function fetchRatings(userId: string): Promise<BookRating[]> {
  const { data, error } = await supabase
    .from('book_ratings')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as BookRatingRow[]).map(normalizeRating);
}

/** What a rating needs to stand on its own, with no book row behind it. */
export type RateTarget = {
  bookKey: string;
  isbn13?: string | null;
  title: string;
  authors?: string[];
  coverUrl?: string | null;
  publishedDate?: string | null;
};

/**
 * Every rating this user has given, keyed by release.
 *
 * Ratings live apart from the library on purpose: you can rate a book you do
 * not own — a library loan, a friend's copy, a search result —
 * and the score survives adding and removing the book from your shelf. That is
 * why the table is keyed (user_id, book_key) with no FK to public.books.
 */
export function useBookRatings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ratingsQueryKey(user?.id);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchRatings(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`book_ratings:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'book_ratings', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, queryKey]);

  // Memoized rather than `query.data ?? []` inline: a fresh array literal on
  // every render would re-key the lookup below (and every consumer's memo) even
  // when the query result has not changed.
  const ratings = useMemo(() => query.data ?? [], [query.data]);
  const byKey = useMemo(() => new Map(ratings.map((rating) => [rating.bookKey, rating])), [ratings]);

  const ratingFor = useCallback((bookKey: string | null | undefined) => (bookKey ? byKey.get(bookKey) ?? null : null), [byKey]);

  const scoreFor = useCallback(
    (bookKey: string | null | undefined) => personalScore(ratingFor(bookKey)?.ratings),
    [ratingFor],
  );

  /**
   * Upsert, or delete when the form has been emptied — a row of all-zero
   * facets would count as "rated" everywhere (the curve, the average, the
   * rating sort) while showing nothing.
   */
  const saveRating = async (target: RateTarget, next: Ratings, review = '') => {
    if (!user) return;

    if (isEmptyRatings(next) && !review.trim()) {
      await removeRating(target.bookKey);
      return;
    }

    const { error } = await supabase.from('book_ratings').upsert(
      stripUndefined({
        user_id: user.id,
        book_key: target.bookKey,
        isbn13: target.isbn13 ?? null,
        title: target.title,
        authors: target.authors ?? [],
        cover_url: target.coverUrl ?? null,
        published_date: target.publishedDate ?? null,
        ratings: next,
        review: review.trim(),
        updated_at: new Date().toISOString(),
      }),
      { onConflict: 'user_id,book_key' },
    );
    if (error) throw error;

    const score = personalScore(next);
    if (score != null && score > 0) {
      // The feed says "rated it 4.5", so it needs the score the user will see —
      // the overall if they set one, the facet average otherwise.
      const { error: activityError } = await supabase.from('book_activity').insert({
        user_id: user.id,
        book_key: target.bookKey,
        book_title: target.title,
        type: 'rating_changed',
        details: { rating: score },
      });
      if (activityError) console.error('Failed to log rating activity', activityError);
    }

    queryClient.invalidateQueries({ queryKey });
  };

  const removeRating = async (bookKey: string) => {
    if (!user) return;
    const { error } = await supabase.from('book_ratings').delete().eq('user_id', user.id).eq('book_key', bookKey);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    ratings,
    loading: query.isLoading,
    error: query.error,
    ratingFor,
    scoreFor,
    saveRating,
    removeRating,
  };
}

/** Read-only ratings for someone else's shelf (RLS decides if they are visible). */
export function usePublicRatings(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['publicRatings', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('book_ratings').select('*').eq('user_id', userId!);
      if (error) throw error;
      return (data as BookRatingRow[]).map(normalizeRating);
    },
    enabled: !!userId,
  });

  const ratings = useMemo(() => query.data ?? [], [query.data]);
  const byKey = useMemo(() => new Map(ratings.map((rating) => [rating.bookKey, rating])), [ratings]);

  return {
    ratings,
    loading: query.isLoading,
    ratingFor: (bookKey: string | null | undefined) => (bookKey ? byKey.get(bookKey) ?? null : null),
  };
}
