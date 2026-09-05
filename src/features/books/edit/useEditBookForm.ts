import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useBooks } from '@/hooks/useBooks';
import { fetchVolume, lookupIsbn } from '@/lib/googleBooks';
import { goBackOrHome } from '@/lib/utils';
import type { Book } from '@/types/book';

import { buildBookPayload, fromBook, hasIssues, isDirty, validate, type BookForm, type FormIssues } from './bookForm';

/**
 * All the state and the save/delete/refresh logic for the book editor. The
 * detail screen renders; this owns the form.
 */
export function useEditBookForm(book: Book | undefined) {
  const router = useRouter();
  const { updateBook, removeBook } = useBooks();

  const [form, setForm] = useState<BookForm | null>(null);
  const [issues, setIssues] = useState<FormIssues>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initializedId = useRef<string | null>(null);

  // Initialize once per book id — a later cache refresh (realtime, the read
  // mirror write) must not clobber edits in progress.
  useEffect(() => {
    if (book && initializedId.current !== book.id) {
      initializedId.current = book.id;
      setForm(fromBook(book));
      setIssues({});
    }
  }, [book]);

  const update = (patch: Partial<BookForm>) => setForm((current) => (current ? { ...current, ...patch } : current));

  const addAuthor = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setForm((current) => (current ? { ...current, authors: [...current.authors, clean] } : current));
  };

  const removeAuthor = (index: number) =>
    setForm((current) => (current ? { ...current, authors: current.authors.filter((_, i) => i !== index) } : current));

  /**
   * Re-pull the catalogue fields. Only facts about the edition are overwritten
   * — status, notes, quotes and the rating are the user's and are never touched
   * by a refresh.
   *
   * The ISBN is tried before the volume id: a book added by scanning has no
   * volume id at all, and an ISBN lookup also reaches Open Library, which is
   * where the older editions live.
   */
  const refreshMetadata = async () => {
    if (!book?.isbn13 && !book?.googleId) return;
    setIsRefreshing(true);
    try {
      const fresh = book.isbn13 ? await lookupIsbn(book.isbn13) : await fetchVolume(book.googleId!);
      if (!fresh) return;
      update({
        title: fresh.title,
        authors: fresh.authors,
        coverUrl: fresh.coverUrl ?? '',
        publishedDate: fresh.publishedDate ?? '',
        url: fresh.url,
      });
      // Genres, page count and the blurb are catalogue-only, so they are
      // written straight through rather than staged in the form being edited.
      await updateBook(
        book.id,
        {
          genres: fresh.genres,
          pageCount: fresh.pageCount,
          publisher: fresh.publisher,
          description: fresh.description,
          googleId: fresh.googleId ?? book.googleId,
        },
        { silent: true },
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const save = async (options: { close?: boolean } = {}) => {
    if (!form || !book) return false;
    const found = validate(form);
    setIssues(found);
    if (hasIssues(found)) return false;

    setIsSaving(true);
    try {
      await updateBook(book.id, buildBookPayload(form));
      if (options.close) goBackOrHome(router);
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  // No navigation here: the detail screen decides where the user lands after a
  // removal (it keeps them on the book so it can be added straight back).
  const remove = async () => {
    if (!book) return;
    setIsSaving(true);
    try {
      await removeBook(book.id);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    form,
    issues,
    update,
    addAuthor,
    removeAuthor,
    refreshMetadata,
    save,
    remove,
    isSaving,
    isRefreshing,
    dirty: !!form && !!book && isDirty(form, book),
  };
}
