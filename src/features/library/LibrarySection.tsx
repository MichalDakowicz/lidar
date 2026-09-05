import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { BookCard } from '@/components/media/BookCard';
import { BookCarousel } from '@/components/media/BookCarousel';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useMeasuredWidth } from '@/hooks/useResponsive';
import { COLORS } from '@/theme/colors';
import type { Book, Ratings } from '@/types/book';

// A 16:9 banner that keeps growing with the viewport turns into a billboard on
// a desktop monitor; past this the card stops scaling and the row just fits more.
const MAX_FEATURED_WIDTH = 760;

type LibrarySectionProps = {
  title: string;
  books: Book[];
  ratingsFor?: (book: Book) => Ratings | null;
  onPress: (book: Book) => void;
  onLogRead?: (book: Book) => void;
  highlightedId?: string | null;
  /** Featured banners for a short rail, cover tiles for a long one. */
  variant?: 'featured' | 'cover';
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

/**
 * One rail above the main grid (Recently finished, Readlist). A lone book
 * renders as a plain full-width banner; two or more go through the carousel,
 * shrunk a touch so the next one peeks in and the row reads as scrollable.
 */
export function LibrarySection({
  title,
  books,
  ratingsFor,
  onPress,
  onLogRead,
  highlightedId,
  variant = 'featured',
  collapsible,
  collapsed,
  onToggleCollapse,
}: LibrarySectionProps) {
  const { width, onLayout } = useMeasuredWidth();
  if (books.length === 0) return null;

  const Chevron = collapsed ? ChevronDown : ChevronUp;
  const action = collapsible ? (
    <Pressable onPress={onToggleCollapse} hitSlop={10} accessibilityLabel={`Toggle ${title}`} className="p-1 active:opacity-70">
      <Chevron size={20} color={COLORS.muted} />
    </Pressable>
  ) : undefined;

  return (
    <View className="gap-2 pb-8 pt-2" onLayout={onLayout}>
      <SectionHeader title={title} count={books.length} action={action} />
      {!collapsed &&
        (variant === 'featured' && books.length === 1 ? (
          <View className="px-4" style={{ maxWidth: MAX_FEATURED_WIDTH }}>
            <BookCard
              book={books[0]}
              variant="featured"
              ratings={ratingsFor?.(books[0]) ?? null}
              onPress={onPress}
              onLogRead={onLogRead}
              highlighted={highlightedId === books[0].id}
            />
          </View>
        ) : (
          <BookCarousel
            books={books}
            cardVariant={variant}
            cardWidth={variant === 'featured' ? Math.min(MAX_FEATURED_WIDTH, width - 64) : undefined}
            ratingsFor={ratingsFor}
            onPress={onPress}
            onLogRead={onLogRead}
            highlightedId={highlightedId}
          />
        ))}
    </View>
  );
}
