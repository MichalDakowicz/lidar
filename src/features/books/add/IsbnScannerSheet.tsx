import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Image } from 'expo-image';
import { BookOpen, Camera, Check, Flashlight, Keyboard, PenLine, Plus, RotateCcw } from 'lucide-react-native';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { BottomSheetTextInput, Sheet, type BottomSheetModal } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useIsbnLookup } from '@/features/books/add/useBookSearch';
import type { BookResult } from '@/lib/bookMetadata';
import { DEFAULT_DRAFT, useQuickAdd, type QuickAddDraft } from '@/features/books/add/useQuickAdd';
import { formatIsbn, isBooklandEan, parseIsbn } from '@/lib/isbn';
import { authorsToDisplayString, publishedYear } from '@/lib/utils';
import { COLORS } from '@/theme/colors';
import type { Book } from '@/types/book';

// The camera fires a scan event per frame while a barcode is in view. Without a
// lock one spine would run thirty lookups a second; with it, the same code is
// ignored until it is cleared or a different book is presented.
const RESCAN_DELAY_MS = 1500;

// EAN-13 is the format a book's back cover carries and its digits are the
// ISBN-13. UPC-A is included because a handful of North American paperbacks
// print one (the ISBN then lives in the price add-on), and EAN-8 because
// scanning one is a clearer "that is not a book" than the camera ignoring it.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a'] as const;

type IsbnScannerSheetProps = {
  draft?: QuickAddDraft;
  /** Called after a book lands on the shelf, so the caller can navigate. */
  onAdded?: (book: Book) => void;
  /** Nothing resolved: hand the ISBN to the by-hand form. The parent closes this sheet first. */
  onAddByHand?: (isbn13: string) => void;
};

/**
 * Add a book by pointing the camera at its barcode.
 *
 * The path is: EAN-13 off the camera → `isBooklandEan` (is this a book at all?)
 * → `lookupIsbn` (Google Books, then Open Library) → one confirmation card with
 * an Add button. It stops at a card rather than adding on sight because a
 * mis-scan of the shelf next to the one you meant would otherwise be silent,
 * and because the status draft is worth seeing before it is written.
 *
 * The camera is native-only. `expo-camera` renders a preview on web but its
 * barcode scanning depends on a `BarcodeDetector` most desktop browsers do not
 * ship, so rather than a preview that never resolves, the web build opens
 * straight to the typed-ISBN field — which is the same code path from the
 * moment a number exists.
 */
export const IsbnScannerSheet = forwardRef<BottomSheetModal, IsbnScannerSheetProps>(function IsbnScannerSheet(
  { draft = DEFAULT_DRAFT, onAdded, onAddByHand },
  ref,
) {
  const { show } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const { add, findByKey, pendingKey } = useQuickAdd();

  const cameraAvailable = Platform.OS !== 'web';
  const [typing, setTyping] = useState(!cameraAvailable);
  const [torch, setTorch] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [isbn, setIsbn] = useState<string | null>(null);

  // Guards the per-frame scan callback. A ref, not state: it has to be readable
  // and writable synchronously inside the callback, and changing it must not
  // re-render the camera.
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  const { book: found, loading, notFound } = useIsbnLookup(isbn);

  const onShelf = found ? findByKey(found.bookKey) : null;

  const reset = useCallback(() => {
    setIsbn(null);
    setManualIsbn('');
    lastScan.current = null;
  }, []);

  // Ask once, when the sheet is first opened with the camera in play.
  useEffect(() => {
    if (cameraAvailable && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [cameraAvailable, permission, requestPermission]);

  const onBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      const now = Date.now();
      const previous = lastScan.current;
      if (previous && previous.code === data && now - previous.at < RESCAN_DELAY_MS) return;
      lastScan.current = { code: data, at: now };

      if (!isBooklandEan(data)) {
        // A valid barcode that is not a book. Saying so is more useful than
        // silence — it tells you the camera is working and you are pointed at
        // the wrong thing.
        show('That barcode is not an ISBN');
        return;
      }
      setIsbn(parseIsbn(data)?.isbn13 ?? null);
    },
    [show],
  );

  const submitTyped = () => {
    const parsed = parseIsbn(manualIsbn);
    if (!parsed) return show('That is not a valid ISBN — check the digits');
    setIsbn(parsed.isbn13);
  };

  /**
   * Nothing answered, so the catalogues cannot name this book — but the number
   * still identifies the edition. Handing it to the Quick-Add sheet is what
   * keeps the hand-typed row keyed `isbn:<n>` rather than `manual:<author>|
   * <title>`, which is what lets a rating made later from a catalogue hit for
   * the same edition find it.
   */
  const handleAddByHand = () => {
    const scanned = isbn;
    reset();
    // The parent closes this sheet before opening the next: two stacked bottom
    // sheets fight over the backdrop and the keyboard.
    if (scanned) onAddByHand?.(scanned);
  };

  const handleAdd = async () => {
    if (!found) return;
    try {
      const book = await add(found, draft);
      if (book) {
        show(`${book.title} added to your ${draft.status.toLowerCase()}`);
        onAdded?.(book);
        reset();
      }
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not add that book');
    }
  };

  return (
    <Sheet ref={ref} snapPoints={['78%']} onDismiss={reset}>
      <View className="flex-1 gap-4 p-4 pb-8">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground">Scan a barcode</Text>
          {cameraAvailable && (
            <Pressable
              onPress={() => setTyping((current) => !current)}
              hitSlop={8}
              accessibilityLabel={typing ? 'Use the camera' : 'Type the ISBN instead'}
              className="flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5"
            >
              {typing ? <Camera size={14} color={COLORS.foreground} /> : <Keyboard size={14} color={COLORS.foreground} />}
              <Text className="text-xs font-medium text-foreground">{typing ? 'Camera' : 'Type it'}</Text>
            </Pressable>
          )}
        </View>

        {isbn ? (
          <ScanResult
            isbn={isbn}
            loading={loading}
            notFound={notFound}
            found={found}
            onShelf={onShelf}
            pending={!!found && pendingKey === found.bookKey}
            onAdd={handleAdd}
            onAddByHand={handleAddByHand}
            onAgain={reset}
          />
        ) : typing || !cameraAvailable ? (
          <View className="gap-3">
            <Text className="text-xs text-muted-foreground">
              The 13 digits under the barcode, or the 10-digit number on the copyright page. Hyphens are fine.
            </Text>
            <BottomSheetTextInput
              value={manualIsbn}
              onChangeText={setManualIsbn}
              onSubmitEditing={submitTyped}
              placeholder="978…"
              placeholderTextColor={COLORS.muted}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              className="h-11 rounded-lg border border-border bg-secondary px-3 text-foreground"
            />
            <Pressable
              onPress={submitTyped}
              disabled={!manualIsbn.trim()}
              style={{ opacity: manualIsbn.trim() ? 1 : 0.5 }}
              className="items-center rounded-full bg-primary py-3 active:opacity-80"
            >
              <Text className="font-semibold text-primary-foreground">Look it up</Text>
            </Pressable>
          </View>
        ) : (
          <CameraPane
            granted={!!permission?.granted}
            canAskAgain={!!permission?.canAskAgain}
            torch={torch}
            onToggleTorch={() => setTorch((current) => !current)}
            onRequest={requestPermission}
            onBarcodeScanned={onBarcodeScanned}
          />
        )}
      </View>
    </Sheet>
  );
});

type CameraPaneProps = {
  granted: boolean;
  canAskAgain: boolean;
  torch: boolean;
  onToggleTorch: () => void;
  onRequest: () => void;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
};

function CameraPane({ granted, canAskAgain, torch, onToggleTorch, onRequest, onBarcodeScanned }: CameraPaneProps) {
  if (!granted) {
    return (
      <View className="flex-1 items-center justify-center gap-4 rounded-2xl border border-border bg-card p-6">
        <Camera size={32} color={COLORS.mutedDeep} />
        <Text className="text-center text-sm text-muted-foreground">
          {canAskAgain
            ? 'Lidar needs the camera to read a book’s barcode.'
            : 'Camera access is off for Lidar. Turn it on in your system settings, or type the ISBN instead.'}
        </Text>
        {canAskAgain && (
          <Pressable onPress={onRequest} className="rounded-full bg-primary px-5 py-2.5 active:opacity-80">
            <Text className="font-semibold text-primary-foreground">Allow camera</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 overflow-hidden rounded-2xl bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={onBarcodeScanned}
      />

      {/* A frame to aim with. Purely visual — the scanner reads the whole
          frame, so a barcode caught outside the box still resolves. */}
      <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
        <View className="h-28 w-4/5 rounded-xl border-2 border-white/70" />
        <Text className="mt-3 text-xs text-white/80">Line up the barcode on the back cover</Text>
      </View>

      <Pressable
        onPress={onToggleTorch}
        accessibilityLabel={torch ? 'Turn the torch off' : 'Turn the torch on'}
        className="absolute bottom-4 right-4 h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: torch ? COLORS.accent : 'rgba(0,0,0,0.55)' }}
      >
        <Flashlight size={18} color="#fafafa" />
      </Pressable>
    </View>
  );
}

type ScanResultProps = {
  isbn: string;
  loading: boolean;
  notFound: boolean;
  found: BookResult | null;
  onShelf: Book | null;
  pending: boolean;
  onAdd: () => void;
  onAgain: () => void;
  onAddByHand: () => void;
};

function ScanResult({ isbn, loading, notFound, found, onShelf, pending, onAdd, onAgain, onAddByHand }: ScanResultProps) {
  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
        <Text className="font-mono text-sm text-foreground">{formatIsbn(isbn)}</Text>
        <Pressable onPress={onAgain} hitSlop={8} accessibilityLabel="Scan another" className="flex-row items-center gap-1.5">
          <RotateCcw size={14} color={COLORS.muted} />
          <Text className="text-xs text-muted-foreground">Scan another</Text>
        </Pressable>
      </View>

      {loading && (
        <View className="items-center py-10">
          <ActivityIndicator color={COLORS.accent} />
        </View>
      )}

      {notFound && (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold text-foreground">Not in any catalogue</Text>
          <Text className="text-sm text-muted-foreground">
            Google Books, Open Library and Biblioteka Narodowa have no record of this edition. Add it by hand — the
            ISBN goes with it, so a rating you give it later still finds this book.
          </Text>
          <Pressable
            onPress={onAddByHand}
            className="flex-row items-center justify-center gap-2 rounded-full border border-border py-3 active:opacity-80"
          >
            <PenLine size={16} color={COLORS.foreground} />
            <Text className="font-medium text-foreground">Add by hand</Text>
          </Pressable>
        </View>
      )}

      {found && (
        <View className="gap-4">
          <View className="flex-row gap-3">
            <View className="h-28 w-20 overflow-hidden rounded-md bg-secondary">
              {found.coverUrl ? (
                <Image source={{ uri: found.coverUrl }} style={{ width: 80, height: 112 }} contentFit="cover" transition={120} />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <BookOpen size={20} color={COLORS.mutedDeep} />
                </View>
              )}
            </View>

            <View className="min-w-0 flex-1 gap-1">
              <Text numberOfLines={2} className="text-base font-bold text-foreground">
                {found.title}
              </Text>
              <Text numberOfLines={2} className="text-sm text-muted-foreground">
                {authorsToDisplayString(found.authors)}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {[found.publisher, publishedYear(found.publishedDate), found.pageCount ? `${found.pageCount} pages` : '']
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
              {/* Which catalogue answered. A wrong record is otherwise
                  untraceable to the source that supplied it. */}
              {!!found.source && (
                <View className="mt-0.5 self-start rounded-full bg-secondary px-2 py-0.5">
                  <Text className="text-[10px] font-medium text-muted-foreground">via {found.source}</Text>
                </View>
              )}
            </View>
          </View>

          {onShelf ? (
            <View className="flex-row items-center justify-center gap-2 rounded-full border border-border py-3">
              <Check size={16} color={COLORS.accent} />
              <Text className="font-medium text-foreground">Already on your shelf ({onShelf.status})</Text>
            </View>
          ) : (
            <Pressable
              onPress={onAdd}
              disabled={pending}
              className="flex-row items-center justify-center gap-2 rounded-full bg-primary py-3 active:opacity-80"
              style={{ opacity: pending ? 0.6 : 1 }}
            >
              {pending ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={16} color="#fafafa" />}
              <Text className="font-semibold text-primary-foreground">Add to my shelf</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
