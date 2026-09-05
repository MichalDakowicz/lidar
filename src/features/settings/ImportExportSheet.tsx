import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Download, FileJson, Upload } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheetTextInput, Sheet, type BottomSheetModal } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useBookRatings } from '@/hooks/useBookRatings';
import { useBooks } from '@/hooks/useBooks';
import { useReads } from '@/hooks/useReads';
import { isDuplicate, parseImport, serializeExport } from '@/lib/dataTransfer';
import { COLORS } from '@/theme/colors';

/**
 * Back up and restore everything that is yours: the library, the ratings
 * (which outlive the books they describe) and the read log.
 *
 * The importer also reads the legacy Firebase export the old web app produced,
 * so a backup taken before the rewrite restores here without conversion — see
 * lib/dataTransfer for the field mapping.
 */
export const ImportExportSheet = forwardRef<BottomSheetModal>(function ImportExportSheet(_props, ref) {
  const { books, addBook } = useBooks();
  const { ratings, saveRating } = useBookRatings();
  const { reads } = useReads();
  const { show } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[]>([]);

  const exportData = async () => {
    setBusy(true);
    try {
      const json = serializeExport(books, ratings, reads, new Date().toISOString());
      const name = `lidar_backup_${new Date().toISOString().slice(0, 10)}.json`;

      // On web that is a download; on native the file is staged in the cache
      // directory and handed to the share sheet.
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      else show(`Saved to ${file.uri}`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not export');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    // Web hands back a blob: URL (fetchable); native gives a file:// uri the
    // file-system File API can read.
    setText(Platform.OS === 'web' ? await (await fetch(uri)).text() : await new File(uri).text());
  };

  const runImport = async () => {
    setBusy(true);
    setReport([]);
    try {
      const parsed = parseImport(text);
      const lines: string[] = [...parsed.errors];

      let added = 0;
      let skipped = 0;
      for (const candidate of parsed.books) {
        // Duplicates are matched on release key, so re-importing the same
        // backup adds nothing rather than doubling the shelf.
        if (isDuplicate(candidate, books)) {
          skipped += 1;
          continue;
        }
        await addBook({ ...candidate, title: candidate.title });
        added += 1;
      }

      let ratingCount = 0;
      for (const rating of parsed.ratings) {
        await saveRating(
          {
            bookKey: rating.bookKey,
            isbn13: rating.isbn13,
            title: rating.title,
            authors: rating.authors,
            coverUrl: rating.coverUrl,
            publishedDate: rating.publishedDate,
          },
          rating.ratings,
          rating.review,
        );
        ratingCount += 1;
      }

      lines.unshift(
        `${added} books added, ${skipped} already on the shelf, ${ratingCount} ratings restored.`,
        // Reads are not replayed: each one would write a row and move the
        // last-played mirror, and a restored log cannot be told from a real one.
        parsed.reads.length > 0 ? `${parsed.reads.length} reads in the file were not imported (history is not replayed).` : '',
      );
      setReport(lines.filter(Boolean));
      show(added > 0 ? `Imported ${added} books` : 'Nothing new to import');
    } catch (error) {
      show(error instanceof Error ? error.message : 'Could not import');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet ref={ref} snapPoints={['70%', '92%']}>
      <ScrollView contentContainerClassName="gap-4 p-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-lg font-bold text-foreground">Import &amp; export</Text>
        <Text className="text-xs text-muted-foreground">
          {books.length} books, {ratings.length} ratings, {reads.length} reads on this account.
        </Text>

        <Pressable
          onPress={exportData}
          disabled={busy}
          className="flex-row items-center justify-center gap-2 rounded-full bg-primary py-3 active:opacity-80"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Download size={16} color="#fff" />
          <Text className="font-semibold text-primary-foreground">Export a backup</Text>
        </Pressable>

        <View className="gap-2 border-t border-border pt-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Restore</Text>
          <Pressable
            onPress={pickFile}
            className="flex-row items-center justify-center gap-2 rounded-full border border-border py-3 active:opacity-80"
          >
            <FileJson size={16} color={COLORS.foreground} />
            <Text className="font-medium text-foreground">Pick a JSON file</Text>
          </Pressable>

          <BottomSheetTextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="…or paste a Lidar backup / legacy Firebase export here"
            placeholderTextColor={COLORS.muted}
            className="min-h-32 rounded-lg border border-border bg-secondary px-3 py-3 font-mono text-xs text-foreground"
          />

          <Pressable
            onPress={runImport}
            disabled={busy || !text.trim()}
            className="flex-row items-center justify-center gap-2 rounded-full border border-border py-3 active:opacity-80"
            style={{ opacity: busy || !text.trim() ? 0.5 : 1 }}
          >
            {busy ? <ActivityIndicator size="small" color={COLORS.accent} /> : <Upload size={16} color={COLORS.foreground} />}
            <Text className="font-medium text-foreground">Import</Text>
          </Pressable>
        </View>

        {report.length > 0 && (
          <View className="gap-1 rounded-lg border border-border bg-secondary/60 p-3">
            {report.map((line) => (
              <Text key={line} className="text-xs text-muted-foreground">
                {line}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
});
