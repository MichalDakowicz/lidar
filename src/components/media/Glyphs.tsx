import { BookCheck, BookOpen, BookX, Bookmark } from 'lucide-react-native';

import type { BookStatus } from '@/types/book';

/**
 * The picture for a shelf status.
 *
 * Written as a component with a branch per case rather than as a lookup table
 * returning a component: a `const Icon = iconFor(x)` reference is a component
 * identity minted during render, which resets any state it holds and is exactly
 * what the react-hooks static-components rule objects to. Each branch below
 * returns fixed JSX instead.
 *
 * It lives here, not in lib/bookStatus, so that stays free of React and remains
 * testable without a renderer.
 */
type GlyphProps = { size?: number; color: string };

export function StatusGlyph({
  status,
  size = 13,
  color,
  filled,
}: GlyphProps & { status: BookStatus; filled?: boolean }) {
  switch (status) {
    case 'Readlist':
      // Filled, because a bookmark outline reads as "not saved" — the opposite
      // of what a readlist badge means.
      return <Bookmark size={size} color={color} fill={filled ? color : 'transparent'} />;
    case 'Reading':
      return <BookOpen size={size} color={color} />;
    case 'Did not finish':
      return <BookX size={size} color={color} />;
    default:
      return <BookCheck size={size} color={color} />;
  }
}
