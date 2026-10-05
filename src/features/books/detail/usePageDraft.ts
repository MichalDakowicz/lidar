import { useState } from 'react';

import type { PageLogMove } from '@/features/books/detail/usePageLog';
import { displayPage, finishesBook, losesBookmark, planPageMove, type BookmarkMode } from '@/lib/progress';
import { formatRelativeTime } from '@/lib/utils';
import type { Book } from '@/types/book';

/**
 * The typed page, what committing it would do, and the one question it may ask
 * first — shared by the book page's Progress panel and the quick page log, so a
 * bookmark moves by the same rules wherever it is moved from.
 */
export function usePageDraft(book: Book, mode: BookmarkMode, onSetPage: (move: PageLogMove) => Promise<void> | void) {
  const saved = displayPage(book.currentPage, mode);
  const [draft, setDraft] = useState(saved == null ? '' : String(saved));
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Re-sync when the row, the book or the mode changes underneath — realtime,
  // another device, the toggle in Settings, or the quick log opening on a
  // different book. Adjusted during render rather than in an effect: an effect
  // would paint the stale number for a frame first.
  const key = `${book.id}|${book.currentPage}|${mode}`;
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setDraft(saved == null ? '' : String(saved));
  }

  const move = planPageMove(book, draft, mode);
  const canSave = move.valid && !move.unchanged && !saving;
  const finishes = move.valid && finishesBook(book, move.to);

  const write = async (next: PageLogMove) => {
    setSaving(true);
    try {
      await onSetPage(next);
    } finally {
      setSaving(false);
    }
  };

  // Save and the keyboard's Done both land here. A move that takes the bookmark
  // off a page it is already on asks first (lib/progress.losesBookmark).
  const save = () => {
    if (!canSave) return;
    if (losesBookmark(move)) setConfirming(true);
    else void write({ page: move.to, pages: move.pages });
  };

  return {
    saved,
    draft,
    setDraft,
    move,
    canSave,
    finishes,
    saving,
    lastSaved: formatRelativeTime(book.progressUpdatedAt),
    save,
    /** Clears the bookmark outright; null while there is none to clear. */
    reset: book.currentPage == null || saving ? null : () => write({ page: null, pages: 0 }),
    confirming,
    cancelConfirm: () => setConfirming(false),
    confirm: () => {
      setConfirming(false);
      if (canSave) void write({ page: move.to, pages: move.pages });
    },
  };
}
