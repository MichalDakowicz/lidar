import { Text } from 'react-native';

import type { PageMove } from '@/lib/progress';
import { COLORS } from '@/theme/colors';

type PageMoveReceiptProps = {
  move: PageMove;
  /** How long ago the bookmark last moved, already humanised. */
  lastSaved: string | null;
  /** Last page of the edition, for the message when the typed page is past it. */
  total: number | null;
};

/**
 * The line that says what pressing Save will do, before it is pressed.
 *
 * It is the confirmation that the reader picked the right bookmark mode: with
 * the wrong one the arithmetic is off by one and they can see it here, rather
 * than finding out at the end of the book that every week was counted a page
 * short.
 */
export function PageMoveReceipt({ move, lastSaved, total }: PageMoveReceiptProps) {
  const since = lastSaved ? ` · last saved ${lastSaved.toLowerCase()}` : '';

  if (move.beyondEnd) {
    return <Text className="text-xs text-red-400">This edition ends on page {total}.</Text>;
  }
  if (!move.valid) {
    return <Text className="text-xs text-muted-foreground">Type the page you are on.</Text>;
  }
  if (move.unchanged) {
    return <Text className="text-xs text-muted-foreground">Same as the saved page{since}</Text>;
  }
  if (move.to == null) {
    return <Text className="text-xs text-muted-foreground">Saving clears the bookmark. No pages counted.</Text>;
  }
  if (move.backwards) {
    return (
      <Text className="text-xs text-amber-400">
        {move.from} → {move.to} · behind the saved page, so it is stored as a correction and counts no pages
      </Text>
    );
  }
  return (
    <Text className="text-xs" style={{ color: COLORS.accent }}>
      {move.from ?? 0} → {move.to} · {move.pages.toLocaleString()} {move.pages === 1 ? 'page' : 'pages'}
      {since}
    </Text>
  );
}
