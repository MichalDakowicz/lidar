import { useQuery } from '@tanstack/react-query';

import { normalizeBook, type BookRow } from '@/lib/normalizeBook';
import { supabase } from '@/lib/supabase';

/**
 * `can_view_user` (Radar's RPC over `private.can_view`) exposed to the client so
 * the UI can tell a private shelf from an empty one — the raw RLS filter
 * returns zero rows either way, and "this person owns nothing" and "this person
 * has not let you in" should not read the same.
 */
export function useCanViewUser(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['canView', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_view_user', { p_target: userId! });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!userId,
  });
  return { canView: query.data ?? null, loading: query.isLoading };
}

/** Someone else's library, read-only. RLS decides whether any rows come back. */
export function usePublicBooks(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['publicBooks', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId!)
        .order('added_at', { ascending: false });
      if (error) throw error;
      return (data as BookRow[]).map(normalizeBook);
    },
    enabled: !!userId,
  });
  return { books: query.data ?? [], loading: query.isLoading, error: query.error };
}
