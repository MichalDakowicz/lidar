import { useBookmarkMode } from '@/store/bookmarkMode';
import type { BookmarkMode } from '@/lib/progress';

import { Segmented } from './Segmented';
import { SettingLabel } from './SettingsSection';

const OPTIONS: { value: BookmarkMode; label: string }[] = [
  { value: 'finished', label: 'Last page read' },
  { value: 'next', label: 'Next page to read' },
];

/**
 * Which number you type when the book page asks what page you are on.
 *
 * *Page 120* means "I finished 120" to one reader and "I am about to read 120"
 * to the next, and a book tracked one way one week and the other the next
 * produces a page count that is quietly wrong — which then corrupts the streak.
 * It lives here rather than on the book page because it is one fact about how a
 * person reads a bookmark, not a decision to retake for every book.
 *
 * Kept on this device (store/bookmarkMode), like the weekly goal.
 */
export function BookmarkModeControl() {
  const { mode, setMode } = useBookmarkMode();
  return (
    <>
      <SettingLabel title="When you save a page" description="Which page number you type on a book" />
      <Segmented options={OPTIONS} value={mode} onChange={setMode} columns={2} />
    </>
  );
}
