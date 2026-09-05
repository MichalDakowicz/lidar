# Lidar — status

**Read this file and you have everything. Do not go looking for context elsewhere first.**
It says what Lidar is, what state it is in, what is verified, what is not, and what to do
next, in order. Update it as work lands — it is the handover, not a changelog.

Last updated: 2026-09-05. Version `0.1.0`, unreleased, nothing built to a device yet.

---

## 1. What Lidar is

A book collection tracker: React Native / Expo SDK 57, Expo Router, NativeWind, Supabase,
TanStack Query, Zustand + MMKV. Android is the practical target (physical device over
ADB); the same code ships to the web through Firebase Hosting.

It is the **third** of three sibling apps in `C:\stuff`, all built on one skeleton:

| App | Path | Domain | Accent |
| --- | --- | --- | --- |
| Radar | `../radar` | Films | Blue |
| Sonar | `../sonar` | Records | Emerald `#10B981` |
| **Lidar** | `.` | **Books** | **Violet `#8B5CF6`** |

They share **one Supabase project** — the same account, profile, friend list and privacy
switch. Radar owns the shared tables. `docs/shared-database.md` is the contract; read it
before touching anything under `supabase/`.

The working agreement (branching, commits, version bumps, build-and-push) is `CLAUDE.md`.
Two rules from it that are easy to get wrong: **never self-attribute a commit**, and
**bump `expo.version` + `versionCode` together**.

### What makes Lidar its own app rather than Sonar with different nouns

1. **ISBN barcode scanning.** The headline feature. The EAN-13 on a back cover *is* the
   ISBN-13, so a scan identifies the exact edition — which a title search cannot.
2. **Two extra statuses.** `Reading` and `Did not finish` beside the siblings'
   Library/Wishlist/Pre-order, plus `books.current_page` as a live bookmark. A record is
   spun in an evening; a book is carried for weeks.
3. **Keyless metadata.** Google Books + Open Library, no credentials. Sonar needs a
   Spotify id and secret; Lidar's `.env` needs only the two Supabase values.

---

## 2. State: what is DONE

Everything below is committed, and `npm test`, `npx tsc --noEmit` and `npm run lint` are
all clean (117 tests, 0 errors, 0 warnings) as of the last commit.

### Repo and tooling
- `git init` done, one commit on `main`, no remote yet.
- `package.json`, `app.json` (`com.michaldakowicz.lidar`, scheme `lidar`, version `0.1.0`,
  `versionCode` 1), `babel/metro/tailwind/tsconfig/eslint`, `plugins/withGradleMemory`,
  `scripts/generate-icons.mjs`, `.gitignore`, `.gitattributes`, `firebase.json`.
- `npm install` run; `node_modules/` present. `expo-camera` pinned to `~57.0.4`
  (`~57.0.6` does not exist — do not "fix" it upward without checking `npm view`).
- Brand SVGs written by hand (`assets/brand/logo.svg` — an open book emitting three
  ranging pulses, violet) and all six PNGs rasterised via `npm run icons`.

### Theme
- `src/theme/colors.ts` — the sibling token set with `--primary` at `258 90% 66%`
  (= `#8B5CF6`) dark, `262 83% 58%` (= `#7C3AED`) light. `COLORS.accent` is the literal
  for icon props and StyleSheets. **The accent lives in exactly these two files**
  (`colors.ts` and the `ACCENT` constants in `NavIslands` / `NavDestinationButton`).

### Database
- `supabase/schema.sql` written and complete: `books`, `book_reads`, `book_ratings`,
  `book_activity`, `book_activity_reactions`, `book_activity_comments`, all indexes, RLS
  in the owner-writes / visible-reads shape, `private.can_view_book_activity`, realtime
  publication. Opens with a prerequisite check against Radar's shared tables.
- `docs/shared-database.md` — the three-app contract, the `book_key` table, why ratings
  have no FK.
- **NOT YET RUN against the live project.** See §3.

### The book domain (hand-written, not ported)
- `src/types/book.ts` — `Book`, `BookRating`, `Read`, `BookActivityEvent`, `Format`,
  `BookStatus`, `Ratings`.
- `src/lib/isbn.ts` + `isbn.test.ts` — check digits for ISBN-10 and -13, the 978/979
  Bookland test that rejects a cereal box, 10↔13 conversion, `parseIsbn` as the one entry
  point. **17 tests, all passing.**
- `src/lib/bookKey.ts` + test — `isbn:` › `gbooks:` › `manual:`, with an
  `UNDECOMPOSABLE` map so `ł`, `ø`, `đ` etc. slug correctly (NFKD will not split them;
  without it "Stanisław Lem" keyed as `stanis-aw-lem`).
- `src/lib/googleBooks.ts` — `searchBooks`, `lookupIsbn` (Google by ISBN-13, then by
  ISBN-10, then Open Library), `fetchVolume`. Covers upgraded to https and de-curled.
- `src/lib/normalizeBook.ts` — the single read boundary (`normalizeBook`, `normalizeRead`,
  `normalizeRating`) and the single write mapper (`toBookRow` + `stripUndefined`).
- `src/lib/formats.ts`, `bookStatus.ts` (incl. `readingProgress`), `ratings.ts` (facets:
  prose / plot / characters / replay).

### The barcode scanner — done, unverified on hardware
- `src/features/books/add/IsbnScannerSheet.tsx` — `CameraView` with
  `barcodeTypes: ['ean13','ean8','upc_a']`, a 1.5 s re-scan lock, torch toggle, permission
  states, a typed-ISBN fallback, and a confirmation card that says "already on your shelf"
  when the key is known. Web opens straight to the typed field.
- `src/store/isbnScanner.ts` — one instance, mounted by `(tabs)/_layout.tsx`, opened from
  anywhere. One live `CameraView` in the tree, deliberately.
- `useIsbnLookup` in `useBookSearch.ts` caches a scan the same way a search is cached.
- `app.json` declares the `expo-camera` plugin with a camera permission string.

### Ported from Sonar and adapted (the whole rest of the app)
The entire `src/` tree was copied from Sonar and machine-transformed to the book domain,
then hand-fixed until types, tests and lint were clean. That covers: the nav islands and
layout shell, auth (Google OAuth + email), the Library tab with filters/facets/grouping/
sort, the Ratings tier board, Stats, the Social feed with reactions and comments, friends
and requests, the profile and public shelf, Settings with theme/privacy/card size and
import-export, all `components/ui` primitives, and every store.

Renames worth knowing: `albums→books`, `spins→reads`, `artist→authors`,
`collection→library`, `release→edition` (route `/edition/[bookKey]`), `spotify→googleBooks`,
`TrackList` → new `ProgressPanel`, `SpinStrip` → `ReadStrip`.

### New, with no Sonar equivalent
- `src/features/books/detail/ProgressPanel.tsx` — the page bookmark and the Finished
  button on the book page.

---

## 3. State: what is NOT done — in the order to do it

### Step 1 — `.env` (blocks everything; needs the user)
`.env` does not exist. Create it from `.env.example` with the **same two values Radar and
Sonar use**:

```sh
cp .env.example .env
```

Then copy `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` out of
`../radar/.env` (both are gitignored, so read them, do not guess).
`EXPO_PUBLIC_GOOGLE_BOOKS_KEY` stays blank — search works without it.

### Step 2 — apply the schema (needs the user; one paste)
`supabase/schema.sql` has never been run. Radar's schema is already live on that project,
so the prerequisite check will pass. Ask the user to open **Supabase Dashboard → SQL
Editor → New query → paste `supabase/schema.sql` → Run**, and to say whether it errored.
Nothing in the app works before this: every query hits a table that does not exist.

### Step 3 — Firebase (the project exists; it is not linked here)
The user has confirmed the Firebase project is **created and ready, just not initialised
in this repo**. `.firebaserc` is gitignored and absent. Ask the user for the project id
(Radar's is `radar-watchlist`, Sonar's is `sonar-tracker`, so it is probably something
like `lidar-library` — **ask, do not assume**), then:

```sh
firebase use --add        # or write .firebaserc by hand
```

`.firebaserc` shape:

```json
{ "projects": { "default": "<project-id>" } }
```

`firebase.json` is already correct (serves `dist/`, SPA rewrite, cache headers). If the
CLI is not authenticated, tell the user to run `! firebase login` — do not work around it.

### Step 4 — first build to the phone
Never built. `adb devices` to confirm a device, then:

```sh
npx expo prebuild -p android
npx expo run:android --device
```

Expect the first prebuild to be slow. Note the JDK caveat in
`plugins/withGradleMemory.js`: build with a JDK 21, not 24+.

### Step 5 — verify the scanner on real hardware
This is the one feature that cannot be checked from a keyboard, and the whole app is named
after it. On the device: open Add → Scan the barcode → point at a real book. Check
(a) the permission prompt appears, (b) a book resolves, (c) a non-book barcode says "That
barcode is not an ISBN", (d) the torch works, (e) a book already on the shelf reports so.
If `onBarcodeScanned` never fires, the first thing to check is that this is a dev build
and not Expo Go — `expo-camera`'s native module is not in the Go binary.

### Step 6 — deploy web, then release
`npm run deploy:web` once the phone build passes. Then the release checklist in
`CLAUDE.md`.

---

## 4. Known gaps and rough edges

Ordered by how much they matter. None of these block a build.

1. **Comment prose still describes records.** The user-visible copy was swept (twice), but
   plenty of code comments in the ported files still say "record", "listen", "sleeve",
   "the legacy Firebase app". Harmless, but it will read as sloppy on the next visit.
   `grep -rniE 'record|sleeve|listen|vinyl|spun' src` finds them.
2. **Stats are still record-shaped.** `src/lib/stats.ts` and `features/stats/StatsView.tsx`
   count books and reads correctly, but the *interesting* book stat — pages read in a
   period — is not computed anywhere, even though `book_reads.page_count` is stored for
   exactly that. Add it beside the existing counts.
3. **`ReadHistory` still offers "log a read" as a bare button** with no started/finished
   dates, while `ProgressPanel` has the real Finished flow. They overlap; decide which one
   owns logging a read.
4. **`book_reads.started_at` is written nowhere.** The column exists, `Read.startedAt` is
   in the type, nothing sets it. Either set it when a book moves to `Reading`, or drop it
   from the UI's vocabulary.
5. **Series is stored, never shown.** `books.series` / `series_index` are in the schema and
   the type; no screen reads them. Grouping the Library by series would be a natural fit.
6. **`RandomReadSheet`** is Sonar's "random spin" picker renamed. It works, but its framing
   ("draw a record") was only half rewritten and the interaction is built around an
   evening's listening, not a week's reading.
7. **No `scripts/migrate-firebase.ts`.** Sonar has one; Lidar has no legacy data, so this
   is deliberate, not missing. `src/lib/dataTransfer.ts` still reads a legacy-shaped JSON
   export, which is what the Settings import uses.
8. **The nav's left action on the Library tab opens Quick-Add, not the scanner.** Scanning
   is one tap deeper than it could be. Consider making a long-press go straight to the
   camera.

---

## 5. Facts you will otherwise waste time rediscovering

- **Bash heredocs in this repo's tooling are fragile.** Several multi-line `cat > file
  <<'EOF'` calls failed with "unexpected EOF while looking for matching quote" on content
  that was perfectly valid. Write files with the Write tool, or with a `node` script.
- **Do not type a `\u`-escape into a regex through an editor that normalises it.** The
  combining-mark range in `bookKey.ts` had to be written by a node script building the
  backslash with `String.fromCharCode(92)`.
- **`expo-camera@~57.0.6` does not exist.** Latest 57 line is `57.0.4`.
- **ESLint's `react-hooks/set-state-in-effect` is an error, not a warning.** `ProgressPanel`
  re-syncs its draft by adjusting state during render, not in an effect. Copy that pattern.
- **Formats default to `Paperback` when a row has none** (`normalizeFormats`), the way
  Sonar defaults to Digital. It is a deliberate choice, not a bug.
- **The three apps must not diverge on `user_settings`.** Lidar writes `friends_visibility`
  and `theme` only, through a sparse upsert. Widening that write is how you clobber
  Radar's columns.

---

## 6. Commands

| Task | Command |
| --- | --- |
| Dev server | `npm start` |
| Android device | `npx expo run:android --device` |
| Tests | `npm test` |
| Lint | `npm run lint` |
| Types | `npx tsc --noEmit` |
| Web build | `npm run build:web` |
| Deploy web | `npm run deploy:web` |
| App icons | `npm run icons` |
