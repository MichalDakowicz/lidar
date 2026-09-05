import type { Book, BookStatus } from '@/types/book';

/**
 * The book editor's form state, and the pure translation both ways. Kept apart
 * from the hook so the save rules are testable without a renderer: which fields
 * are catalogue facts, which are yours, and what actually gets written.
 */
export type BookForm = {
  title: string;
  authors: string[];
  coverUrl: string;
  publishedDate: string;
  /** Kept as typed text so a half-deleted number does not become 0 mid-edit. */
  pageCount: string;
  startPage: string;
  url: string;
  status: BookStatus;
  notes: string;
  favoriteQuotes: string;
};

export function fromBook(book: Book): BookForm {
  return {
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl ?? '',
    publishedDate: book.publishedDate ?? '',
    pageCount: book.pageCount != null ? String(book.pageCount) : '',
    startPage: book.startPage != null ? String(book.startPage) : '',
    url: book.url,
    status: book.status,
    notes: book.notes,
    favoriteQuotes: book.favoriteQuotes,
  };
}

export type FormIssues = { title?: string; pageCount?: string; startPage?: string };

/** A blank field is "unknown", not zero. Anything else has to be a real page. */
function pageNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validate(form: BookForm): FormIssues {
  const issues: FormIssues = {};
  if (!form.title.trim()) issues.title = 'A book needs a title';

  const pages = pageNumber(form.pageCount);
  const start = pageNumber(form.startPage);

  if (form.pageCount.trim() && (pages == null || pages < 1)) {
    issues.pageCount = 'Pages has to be a number';
  }
  if (form.startPage.trim() && (start == null || start < 1)) {
    issues.startPage = 'The first page has to be a number';
  } else if (start != null && pages != null && start > pages) {
    // Not a warning: a start past the end would make the book negative pages
    // long, and lib/pages would have to paper over it on every read.
    issues.startPage = `The story cannot start after page ${pages}`;
  }

  return issues;
}

export function hasIssues(issues: FormIssues): boolean {
  return Object.keys(issues).length > 0;
}

/**
 * The save payload. Status is included even when unchanged so the write path
 * can compare it against the current row and log the status-changed event —
 * that comparison lives in useBooks, which is the only place that knows the
 * row as it was.
 */
export function buildBookPayload(form: BookForm): Partial<Book> {
  return {
    title: form.title.trim(),
    authors: form.authors,
    coverUrl: form.coverUrl.trim() || null,
    publishedDate: form.publishedDate.trim() || null,
    pageCount: pageNumber(form.pageCount),
    startPage: pageNumber(form.startPage),
    url: form.url.trim(),
    status: form.status,
    notes: form.notes,
    favoriteQuotes: form.favoriteQuotes.trim(),
  };
}

/** Did anything the user can edit actually change? Drives the save button. */
export function isDirty(form: BookForm, book: Book): boolean {
  const original = fromBook(book);
  return (
    form.title !== original.title ||
    form.authors.join(' ') !== original.authors.join(' ') ||
    form.coverUrl !== original.coverUrl ||
    form.publishedDate !== original.publishedDate ||
    form.pageCount !== original.pageCount ||
    form.startPage !== original.startPage ||
    form.url !== original.url ||
    form.status !== original.status ||
    form.notes !== original.notes ||
    form.favoriteQuotes !== original.favoriteQuotes
  );
}
