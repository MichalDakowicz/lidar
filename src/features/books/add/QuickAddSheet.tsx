import { useRouter } from 'expo-router';
import { PenLine, ScanBarcode, Search } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheetTextInput, Sheet, type BottomSheetModal } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { AddSearchResults } from '@/features/books/add/AddSearchResults';
import { StatusPicker } from '@/features/books/add/StatusPicker';
import { useBookSearch } from '@/features/books/add/useBookSearch';
import { DEFAULT_DRAFT, useQuickAdd, type QuickAddDraft } from '@/features/books/add/useQuickAdd';
import { useIsbnScannerStore } from '@/store/isbnScanner';
import { authorList } from '@/lib/bookKey';
import type { BookResult } from '@/lib/googleBooks';
import { COLORS } from '@/theme/colors';

/**
 * Add a book from anywhere: mounted once by the tabs layout, opened by the nav
 * bar's left action on the library tab.
 *
 * Three ways in, in the order they are worth reaching for with a physical book
 * in your hand: scan the barcode, search the title, type it yourself. The scan
 * button is first and full-width because it is the one that needs no typing at
 * all, and because it is the only one that gets the *edition* right — a title
 * search returns whichever printing Google ranked highest, which is rarely the
 * one on your shelf.
 *
 * The status picker sits above the results because it applies to whatever you
 * pick next, and the default — the readlist — is what most adds want.
 */
export const QuickAddSheet = forwardRef<BottomSheetModal>(function QuickAddSheet(_props, ref) {
  const router = useRouter();
  const { show } = useToast();
  const [term, setTerm] = useState('');
  const [draft, setDraft] = useState<QuickAddDraft>(DEFAULT_DRAFT);
  const [manual, setManual] = useState({ title: '', authors: '' });
  const [manualOpen, setManualOpen] = useState(false);
  const { results, loading } = useBookSearch(term);
  const { add, addManual, isAdded, pendingKey } = useQuickAdd();
  const presentScanner = useIsbnScannerStore((s) => s.present);

  const dismiss = () => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();

  const handleAdd = async (found: BookResult) => {
    try {
      const book = await add(found, draft);
      if (book) show(`${book.title} added to your ${draft.status.toLowerCase()}`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not add that book');
    }
  };

  // Opening the book page is the path that also lets you rate something you are
  // not adding, so the sheet closes rather than sitting behind it.
  const handleSelect = (found: BookResult) => {
    dismiss();
    router.push({ pathname: '/edition/[bookKey]', params: { bookKey: found.bookKey } });
  };

  const handleScan = () => {
    // One sheet at a time: two stacked bottom sheets fight over the backdrop
    // and the keyboard, and the scanner wants the whole screen anyway.
    dismiss();
    presentScanner?.(draft);
  };

  const handleManualAdd = async () => {
    const title = manual.title.trim();
    if (!title) return show('Give the book a title first');
    try {
      const book = await addManual({ title, authors: authorList(manual.authors) }, draft);
      if (book) {
        show(`${book.title} added`);
        setManual({ title: '', authors: '' });
        setManualOpen(false);
        dismiss();
        router.push({ pathname: '/book/[bookId]', params: { bookId: book.id } });
      }
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not add that book');
    }
  };

  return (
    <Sheet ref={ref} snapPoints={['70%', '92%']}>
      <ScrollView contentContainerClassName="gap-5 p-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-lg font-bold text-foreground">Add a book</Text>

        <Pressable
          onPress={handleScan}
          accessibilityLabel="Scan a book's ISBN barcode"
          className="flex-row items-center justify-center gap-2 rounded-full bg-primary py-3.5 active:opacity-80"
        >
          <ScanBarcode size={18} color="#fafafa" strokeWidth={2.2} />
          <Text className="font-semibold text-primary-foreground">
            {Platform.OS === 'web' ? 'Enter an ISBN' : 'Scan the barcode'}
          </Text>
        </Pressable>

        <View className="relative">
          <View className="absolute bottom-0 left-3 top-0 z-10 justify-center">
            <Search size={18} color={COLORS.muted} />
          </View>
          <BottomSheetTextInput
            value={term}
            onChangeText={setTerm}
            placeholder="Title, author, or an ISBN"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
            className="h-11 rounded-lg border border-border bg-secondary pl-10 pr-3 text-foreground"
          />
        </View>

        <StatusPicker status={draft.status} onStatusChange={(status) => setDraft({ status })} />

        <AddSearchResults
          results={results}
          loading={loading}
          query={term}
          isAdded={isAdded}
          pendingKey={pendingKey}
          onSelect={handleSelect}
          onAdd={handleAdd}
        />

        <View className="gap-3 border-t border-border pt-4">
          {manualOpen ? (
            <>
              <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Add by hand</Text>
              <BottomSheetTextInput
                value={manual.title}
                onChangeText={(title) => setManual((current) => ({ ...current, title }))}
                placeholder="Book title"
                placeholderTextColor={COLORS.muted}
                className="h-11 rounded-lg border border-border bg-secondary px-3 text-foreground"
              />
              <BottomSheetTextInput
                value={manual.authors}
                onChangeText={(authors) => setManual((current) => ({ ...current, authors }))}
                placeholder="Author (separate several with ;)"
                placeholderTextColor={COLORS.muted}
                className="h-11 rounded-lg border border-border bg-secondary px-3 text-foreground"
              />
              <Pressable
                onPress={handleManualAdd}
                className="items-center rounded-full bg-primary py-3 active:opacity-80"
                disabled={!manual.title.trim()}
                style={{ opacity: manual.title.trim() ? 1 : 0.5 }}
              >
                <Text className="font-semibold text-primary-foreground">Add and open</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => setManualOpen(true)}
              className="flex-row items-center justify-center gap-2 rounded-full border border-border py-3 active:opacity-80"
            >
              <PenLine size={16} color={COLORS.foreground} />
              <Text className="font-medium text-foreground">Not in the catalogues? Add by hand</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
});
