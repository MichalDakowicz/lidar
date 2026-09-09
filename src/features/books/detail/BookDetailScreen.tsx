import { Plus, RefreshCw, Save } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import { StatusPicker } from '@/features/books/add/StatusPicker';
import { DetailHero } from '@/features/books/detail/DetailHero';
import { BookDetails } from '@/features/books/detail/BookDetails';
import { ReadHistory } from '@/features/books/detail/ReadHistory';
import { ProgressPanel } from '@/features/books/detail/ProgressPanel';
import { RemoveFromLibrary } from '@/features/books/detail/RemoveFromLibrary';
import { TimesReadBox } from '@/features/books/detail/TimesReadBox';
import { useBookDetail } from '@/features/books/detail/useBookDetail';
import { useEditBookForm } from '@/features/books/edit/useEditBookForm';
import { RatingEditor } from '@/features/ratings/RatingEditor';
import { useNavBarSpace } from '@/hooks/useNavBarSpace';
import { MAX_W, useCenteredContentStyle } from '@/hooks/useResponsive';
import { useBookmarkMode } from '@/store/bookmarkMode';
import { COLORS } from '@/theme/colors';

type BookDetailScreenProps = {
  bookId?: string;
  bookKey?: string;
};

/**
 * One screen for a book, tracked or not — the same unification Radar applies to
 * films. Both routes render the same hero and rating editor; a book that is on
 * your shelf also gets the reading controls (status, progress, reads, notes)
 * and, at the very bottom, the way back off it.
 *
 * The header carries one action at most, and only the untracked state gets a
 * big one: "Add to library" is why you opened a book you do not own. Owning it
 * needs nothing at the top — the shelf controls say so on the way down.
 *
 * Removing a book leaves you right here in the untracked state, so it can be
 * put back with one tap, and the rating you gave it stays either way.
 */
export function BookDetailScreen({ bookId, bookKey }: BookDetailScreenProps) {
  const detail = useBookDetail({ bookId, bookKey });
  const editForm = useEditBookForm(detail.book ?? undefined);
  const contentStyle = useCenteredContentStyle(MAX_W.detail);
  const navBarSpace = useNavBarSpace();
  const { show } = useToast();
  const bookmarkMode = useBookmarkMode((state) => state.mode);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { book, display } = detail;
  const form = editForm.form;

  if (detail.loading && !display) return <LoadingState label="Loading…" />;
  if (!display) {
    return (
      <EmptyState
        title="Book not found"
        description={
          detail.unresolved
            ? 'This book is not on your shelf and no catalogue has a record of it.'
            : 'Try opening it again from your library.'
        }
      />
    );
  }

  const tracked = !!book;

  // Nothing but the metadata refresh sits in the header of a book you own:
  // being on the shelf is said by the shelf controls below, and taking it off
  // is the last thing on the page, not the first (RemoveFromLibrary).
  const action = tracked ? (
    book.googleId ? (
      <Pressable
        onPress={editForm.refreshMetadata}
        disabled={editForm.isRefreshing}
        accessibilityLabel="Refresh metadata from Google Books"
        className="self-start rounded-full border border-border bg-black/40 p-2.5 active:opacity-80"
      >
        {editForm.isRefreshing ? <ActivityIndicator size="small" color={COLORS.muted} /> : <RefreshCw size={16} color={COLORS.muted} />}
      </Pressable>
    ) : null
  ) : (
    <Pressable
      onPress={async () => {
        const added = await detail.addToShelf();
        if (added) show(`${added.title} added to your library`);
      }}
      disabled={detail.pending}
      className="flex-row items-center justify-center gap-2 self-start rounded-full bg-primary px-5 py-3 active:opacity-80"
      style={{ opacity: detail.pending ? 0.6 : 1 }}
    >
      {detail.pending ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={16} color="#fff" />}
      <Text className="font-semibold text-primary-foreground">Add to library</Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={[contentStyle, { paddingBottom: navBarSpace + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <DetailHero
          bookKey={display.bookKey}
          title={display.title}
          authors={display.authors}
          coverUrl={display.coverUrl}
          publishedDate={display.publishedDate}
          pageCount={display.pageCount}
          ratings={detail.ratings}
          action={action}
        />

        <View className="gap-8 px-4 pt-6">
          {/* Rating comes first, and is here whether or not you own it — that is
              the whole point of keeping ratings in their own table. */}
          <RatingEditor
            target={{
              bookKey: display.bookKey,
              isbn13: display.isbn13,
              title: display.title,
              authors: display.authors,
              coverUrl: display.coverUrl,
              publishedDate: display.publishedDate,
            }}
            note={tracked ? undefined : 'You can rate this without adding it — the score is kept against the book.'}
          />

          {tracked && form && (
            <>
              <View className="gap-4">
                <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">On your shelf</Text>
                <StatusPicker status={form.status} onStatusChange={(status) => editForm.update({ status })} />

                <TimesReadBox
                  dated={detail.reads.length}
                  undated={book.undatedReads}
                  onLogRead={async () => {
                    await detail.logRead();
                    show(`Finished ${display.title}`);
                  }}
                  onRemoveNewestRead={async () => {
                    // The log is newest-first, so this is the finish just added
                    // by mistake — the one anybody stepping down means.
                    const newest = detail.reads[0];
                    if (!newest) return;
                    await detail.removeRead(newest.id);
                    show('Latest finish removed');
                  }}
                  onSetUndated={detail.setUndatedReads}
                />
              </View>

              <ProgressPanel
                book={book}
                mode={bookmarkMode}
                form={form}
                onFormChange={editForm.update}
                issues={editForm.issues}
                onSetPage={async (move) => {
                  // Saving the last page is what finishes a book now — there is
                  // no separate button to press and no way to do both.
                  const finished = await detail.setPage(move);
                  if (finished) show(`Finished ${display.title}`);
                  // Reset is the one action whose whole worry is "did I just
                  // lose my streak", so it answers before it is asked.
                  else if (move.page == null) show('Bookmark reset — the pages you read stay counted');
                }}
              />

              <ReadHistory reads={detail.reads} undated={book.undatedReads} onRemoveRead={detail.removeRead} />

              <BookDetails form={form} onChange={editForm.update} />
            </>
          )}

          {display.genres.length > 0 && (
            <View className="gap-2">
              <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Genres</Text>
              <View className="flex-row flex-wrap gap-2">
                {display.genres.map((genre) => (
                  <View key={genre} className="rounded-full border border-border px-3 py-1.5">
                    <Text className="text-xs text-muted-foreground">{genre}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {tracked && <RemoveFromLibrary onPress={() => setConfirmRemove(true)} />}
        </View>
      </ScrollView>

      {tracked && form && editForm.dirty && (
        <Pressable
          onPress={async () => {
            const saved = await editForm.save();
            show(saved ? 'Changes saved' : 'Fix the highlighted fields first');
          }}
          disabled={editForm.isSaving}
          accessibilityLabel="Save changes"
          className="absolute bottom-28 right-6 h-16 w-16 items-center justify-center rounded-full bg-primary shadow-xl"
          style={{ opacity: editForm.isSaving ? 0.6 : 1 }}
        >
          {editForm.isSaving ? <ActivityIndicator color="#fff" /> : <Save size={26} color="#fff" />}
        </Pressable>
      )}

      <ConfirmDialog
        visible={confirmRemove}
        title="Remove from library"
        description={`Take "${display.title}" off your shelf? Your rating and review are kept — they belong to the release, not the copy.`}
        confirmLabel="Remove"
        destructive
        loading={editForm.isSaving}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          setConfirmRemove(false);
          await detail.removeFromShelf();
          show(`${display.title} removed`);
        }}
      />
    </View>
  );
}
