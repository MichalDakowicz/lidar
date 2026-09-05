import { Text, View } from 'react-native';

import { StatusGlyph } from '@/components/media/Glyphs';
import { statusMeta } from '@/lib/bookStatus';
import type { Book, BookStatus } from '@/types/book';

/**
 * The reading status, drawn only when it is not the default. `Read` is the
 * common case and a badge on nearly every card is noise, not information — a
 * readlist entry or an abandoned book is the thing worth flagging.
 */
export function StatusBadge({ status, size = 13 }: { status: BookStatus; size?: number }) {
  if (status === 'Read') return null;
  const meta = statusMeta(status);

  return (
    <View className="rounded bg-black/55 p-1">
      <StatusGlyph status={status} size={size} color={meta.color} filled />
    </View>
  );
}

/** Status as a labelled pill, for detail screens and pickers. */
export function StatusPill({ book }: { book: Book }) {
  const meta = statusMeta(book.status);

  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: meta.tint }}
    >
      <StatusGlyph status={book.status} color={meta.color} />
      <Text className="text-xs font-semibold" style={{ color: meta.color }}>
        {meta.label}
      </Text>
    </View>
  );
}
