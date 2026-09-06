# Lidar 0.2.0 — align with Radar

**This is the work order for the next session. Read it with `STATUS.md` and nothing else
is needed.** `STATUS.md` says where the app stands today; this says where it is going and
in what order. Tick items off here as they land, and move anything finished into
`STATUS.md` §2.

Written 2026-09-05, before any of it was coded. **Items 1, 2, 3, 5, 6, 7 and 9 are done**
— 9 partly: see its hit rate below, one open question for the user; 7 landed 2026-09-06.
Item 4 (Readlist surfaces) and 8 (top 4) are still untouched.

---

## 0. The one-paragraph version

Lidar was ported from Sonar, so it inherited a **record collection's** shape: square cover
art, formats you own a copy in, a wishlist, a tier-list rating page. Books are not
records — they are closer to films. This release re-cuts Lidar to follow **Radar**:
rectangular covers, no ownership at all, a readlist instead of a wishlist, Browse instead
of the rating page, Radar's stats with a page-based reading streak, a pinned top 4, and a
page tracker that does the arithmetic for you. Plus a Polish ISBN source, because the two
current catalogues barely cover Polish books.

---

## 1. Decisions already made

These are settled — do not re-litigate them, just build them.

| Question | Answer |
| --- | --- |
| Cover shape | **Rectangular, 2:3**, like Radar's posters. Sonar's square is album art and wrong here. |
| Ownership | **Gone entirely.** No formats, no "which copy do you own". Lidar tracks *reading*, not a shelf of objects. |
| Statuses | Reading-lifecycle only, mirroring Radar's Watchlist/Watched: **`Readlist`, `Reading`, `Read`, `Did not finish`**. |
| Rating page | **Removed.** Rating stays, but only on the book page. The S–F tier board goes. |
| Second tab | **Browse** (Radar's discovery shape), replacing Ratings. |
| Recently finished rail | **Removed** from the Library tab. |
| Streak | Radar's weekly-threshold streak, but measured in **pages read per week**, not books. |
| Top 4 | Yes — a pinned top 4 on the profile, Radar's `FavoritesRow` shape. **Must not use `profiles.favorites`** (see §3). |
| Page tracking | User types one number, app decides the rest. See §7. |
| ISBN sources | **Target Poland specifically** — Biblioteka Narodowa first, behind the existing `lookupIsbn` boundary. See §9. |

## 2. Open questions

1. ~~**Does the tier board die or move?**~~ **Answered 2026-09-05: it dies entirely.**
   Delete `TierBoard`, `DropSheet`, `UnratedRail`, `RatingSearchRow` and `lib/tiers.ts`
   with the tab. Rating a book stays, on the book page only. No tier grouping on the
   Library.
2. ~~**Top 4 storage**~~ **Answered 2026-09-05: option A**, a new `book_favorites jsonb`
   column on `public.user_settings`. `docs/shared-database.md` has to be updated in the
   same PR as Item 8.
3. ~~**The failing ISBNs**~~ **Answered 2026-09-05**, three of them, all `978-83-…`:
   `978-83-08-06856-4`, `978-83-66324-20-6`, `978-83-8196-545-3`. Results in §9.
4. ~~**e-ISBN: scrape or stop?**~~ **Answered 2026-09-05 — neither.** The user found
   an actual documented API (dane.gov.pl dataset 3178): `e-isbn.pl/IsbnWeb/api.xml`,
   ONIX 3.0, free, keyless, no scrape needed. Built. See §9.
5. **Does e-ISBN work on the phone?** — NEW, and the only thing left open on §9.
   e-isbn.pl serves an incomplete TLS chain (leaf only, no Certum intermediate). Node
   rejects it and Android's TrustManager does not chase AIA, so this provider may be a
   silent no-op on device while working on the web build. It fails safe — the chain
   catches the throw and moves on. **Scan `978-83-8196-545-3` on the phone**; if it comes
   back "not in any catalogue" there but resolves on the web build, that is this.

---

## 3. The `profiles.favorites` trap — read before building the top 4

Radar's pinned top 4 lives in `public.profiles.favorites`, a jsonb array with a
`jsonb_array_length(favorites) <= 4` CHECK. **That column is Radar's and is off limits**
(`docs/shared-database.md`, and it is the one exclusion Sonar's doc calls out by name).
Writing book picks into it would silently overwrite the four films the same person pinned
in Radar — one profile row, one column, four slots.

Two ways to give Lidar its own:

- **A (recommended): add `book_favorites jsonb` to `public.user_settings`.** Rule 4 of the
  shared-database contract explicitly allows *adding* a column to a shared table; it only
  forbids writing a column another app owns. One settings row per user, and Radar's
  `FavoritesRow` / `FavoritesEditorSheet` port almost verbatim because the shape matches.
  Requires updating `docs/shared-database.md`, which currently says Lidar touches only
  `friends_visibility` and `theme` on that table.
- **B: a new `public.book_favorites` table** keyed `(user_id, position)`. Unambiguously
  Lidar-owned, no contract edit — but a second query on every profile open for at most
  four rows.

Either way the stored entry is a **snapshot** (`book_key`, title, authors, cover), for the
same reason Radar's is: it has to render with no `books` row behind it.

---

## 4. Work items, in order

Each is a branch and a PR. Do them in this order — later ones assume earlier ones.

### Item 1 — Strip ownership `feat/drop-ownership` — **DONE 2026-09-05**

The foundation; everything else is easier once this is gone.

Landed as described, plus three things the plan did not anticipate:

- `hooks/useReads.ts` was writing the retired `'Library'` status when a read was logged.
  Finishing a book now sets `Read` whatever it was before, so a readlist book read in one
  sitting lands in the right place.
- `store/libraryPrefs.ts` needed a real `migrate`, not a bare version bump: a bump alone
  throws the persisted blob away and takes view mode, card size and sort with it. It now
  drops `selectedFormats`, renames `wishlistCollapsed` to `readlistCollapsed`, and resets
  a retired status filter / group-by / sort.
- `features/books/edit/bookForm.ts` was joining with a literal NUL byte
  (`authors.join('\0')`), which made the file read as binary to `grep` and `file`. Fixed
  to a space while the file was open.

File moves: `FormatStatusPicker.tsx` -> `StatusPicker.tsx`, `EditionDetails.tsx` ->
`BookDetails.tsx`, `FormatBadges.tsx` -> `StatusBadges.tsx` (status half only).

- Schema (`supabase/schema.sql`, COLUMN MIGRATIONS section — **never edit a `create
  table`**, the create is skipped on a live database):
  - Widen the `books.status` CHECK to the four new values. Postgres needs the constraint
    dropped and re-added; do it in a guarded do-block that also `update`s any existing row
    off a retired value first (`Library`/`Wishlist`/`Pre-order` → `Readlist` or `Read`).
  - Leave `formats` and `price_paid` **in place, unused**. Dropping a column is forbidden
    by the schema rules, and an old export may still carry them.
- Delete: `src/lib/formats.ts`, `FormatBadges.tsx`, `FormatStatusPicker`'s format half,
  the format facet in `libraryFacets.ts`, the format split in stats, the `Format` type.
- `src/lib/bookStatus.ts`: new `STATUSES` table, new colours, `isOwned` → delete,
  `isReading` stays, add `isReadlist` / `isRead`.
- `src/types/book.ts`: drop `Format`, `formats`, `pricePaid`, `storeName`,
  `acquisitionDate`, `edition` from the app-side type (columns stay in the DB).
- Settings: drop the price/store/edition rows from `EditionDetails.tsx` — rename that file
  to `BookDetails.tsx` while you are in there.
- **Acceptance:** `npm test`, `npx tsc --noEmit`, `npm run lint` clean; no string
  "Hardcover"/"Paperback"/"format" survives `grep -rn` in `src/`.
  **Met:** 111 tests pass, 0 type errors, 0 lint warnings. The only surviving "format"
  strings are the legacy-import fixture (deliberate — an old export still carries a bare
  `format` key), the retired-column documentation in `normalizeBook`/`dataTransfer`, the
  prefs migration, and unrelated helpers (`formatIsbn`, Open Library's `format=json`).

### Item 2 — Rectangular covers `feat/rectangular-covers` — **DONE 2026-09-05**

Radar's values throughout: `aspect-[2/3]` tiles, its column table (Sonar's had one extra
column per step), its carousel widths (176/140), its gradient stops, and `aspect-[2/3]
w-28` on the detail hero. Row cards get a portrait `h-28 w-20` thumbnail.

Beyond the plan: the **Library tab icon was a vinyl record** (`Disc3`), as were every
placeholder on the ratings tab and the public shelf's Library tab. All now book glyphs.
The ratings board's covers were made 2:3 as well — that tab dies in Item 5, but leaving
one screen of squares behind reads as a bug until it does. Also fixed a stale Sonar path:
the Ratings tab claimed `/release`, which does not exist here, so `/edition` lit no tab.

Letterboxing is implemented in `CoverImage` by measuring the jacket on load: within 0.08
of 2:3 it crops (the Google Books case, free), otherwise it is drawn whole over a blurred
copy of itself. The measurement is keyed by uri because FlashList recycles cells.
### Item 2 — Rectangular covers `feat/rectangular-covers` (original plan)

- Port Radar's poster geometry into `BookCard.tsx`, `BookGrid.tsx`, `CoverImage.tsx`,
  `BookCarousel.tsx`. Radar's card is the reference — read
  `../radar/src/components/media/` and match aspect, radius, gradient overlay and the
  hover treatment rather than inventing one.
- `CardSizeControl` column counts need re-tuning for a 2:3 tile; Radar's values are right.
- Cover URLs: Google Books thumbnails are already ~2:3, but Open Library's `large` is
  inconsistent — letterbox rather than crop so a short cover is not chopped.
- **Acceptance:** side-by-side screenshot of Radar's Library and Lidar's Library at the
  same width looks like the same app.

### Item 3 — Remove the Recently finished rail `chore/drop-recent-rail` — **DONE 2026-09-05**

Rail and its `useMemo` gone, and `useLibraryFilters` no longer takes `reads` at all.
`BookCarousel` kept — Stats and the profile shelf still use it. `lib/reads.recentlyPlayed`
had no other caller and was deleted with its test.

### Item 4 — Readlist `feat/readlist`

- The `Readlist` status from Item 1, plus the surfaces that make it a feature rather than a
  filter value: a Readlist section on the Library, an "Add to readlist" action on the book
  page and on every Browse tile, and a count on the profile.
- Radar's equivalent is its Watchlist — read `../radar/src/features/library/` and mirror
  the affordances.

### Item 5 — Browse replaces Ratings `feat/browse-tab` — **DONE 2026-09-05**

Built as specified. `RatingEditor` / `RatingSlider` / `RatingStars` / `lib/ratings.ts` /
`personalScore.ts` / `ratingDistribution.ts` all kept; `RatingCurve` still renders inside
Stats. The tier board, drop sheet, unrated rail, rating search row and `lib/tiers.ts` are
deleted with their test.

**The rows that exist**, from `discoveryRowSpecs` (pure, 8 tests): up to three *More by
<author>* rows from authors you have read, up to two *New in <subject>* rows
(`subject:` + `orderBy=newest`, subject narrowed to the last segment of Google's
breadcrumb), and up to two *Because <author> is on your readlist* rows for authors not
already covered. An empty shelf falls back to three broad subjects so the tab is never
blank. **No Open Library trending row** — it was the plan's nice-to-have and one good row
beats a noisy one; the hook is there if it is ever wanted.

Books already on the shelf are filtered out of every row: the rows are built from what you
have read, so without that "More by Ursula K. Le Guin" opens with the ones you own.

Beyond the plan: `BookCard`/`BookCarousel`/`BookGrid` gained `showStatus`, off for
catalogue tiles — a reading status drawn on a book the shelf has never seen is a lie, and
it also switches off the readlist dimming. `toDiscoveryBook`/`fromDiscoveryBook` convert
between `BookResult` and `Book` so Browse renders through the normal card and writes
through the normal `useQuickAdd`, rather than growing a second set of either.

### Item 5 — Browse replaces Ratings (original plan)

- Delete `src/app/(tabs)/ratings.tsx` and `src/features/ratings/TierBoard.tsx`,
  `DropSheet.tsx`, `UnratedRail.tsx`, `RatingSearchRow.tsx`, `src/lib/tiers.ts`.
  **Keep** `RatingEditor.tsx`, `RatingSlider.tsx`, `RatingStars.tsx`, `src/lib/ratings.ts`,
  `personalScore.ts`, `ratingDistribution.ts` — rating a book is staying, it just lives on
  the book page now.
- Add `src/app/(tabs)/browse.tsx` + `src/features/browse/`, modelled on
  `../radar/src/features/browse/` (14 files: hero, discovery rows, search bar, result grid,
  filter sheet, preload hook).
- Update `navDestinations.tsx` (label `Browse`, icon `Compass` or `Search`), `navActions.tsx`
  (the left island becomes Search on this tab, as Radar's does), and the `Tabs.Screen`
  order in `(tabs)/_layout.tsx`. **Those three must stay in sync — the web digit shortcuts
  index into `NAV_DESTINATIONS`.**
- **The catch:** Radar's Browse is fed by TMDB's curated `trending` / `popular` /
  `upcoming` endpoints. **Google Books has no equivalent.** Do not promise a trending feed.
  Build the rows out of what the book APIs can actually answer:
  - *More by authors you have read* — one query per top author, cached hard.
  - *New this year in your top subjects* — Google Books `subject:` + `orderBy=newest`.
  - *From your readlist's authors*.
  - *Open Library trending* — `openlibrary.org/trending/daily.json` exists and is free;
    treat it as a nice-to-have, its data is noisy.
  - A plain search field, which is the honest primary affordance here.
- **Acceptance:** Browse opens with content on a cold start (preload after login, as
  Radar does), and never shows an empty screen for a user with at least one book.

### Item 6 — Stats + page streak `feat/reading-stats` — **DONE 2026-09-05**

Radar's layout: an eight-cell bordered overview grid, then full-bleed sections with
`text-2xl` headings — no card stack. New components ported: `StreakCalendar` (six months,
shaded in four bands against a seventh of the weekly goal), `GenreTag`, `AuthorItem`
(initials disc, no author images exist), `Masterpieces`.

`src/lib/streak.ts` is Radar's weekly-threshold maths verbatim — it never cared what the
per-day number meant, so pages drop straight in. 15 tests, including the month-straddling
week and a re-read of a different edition counting that edition's length.

**The streak is currently pages from finished books only.** `dailyPages(reads, progress)`
already takes the bookmark deltas as its second argument; it is `[]` until Item 7 writes
`public.book_progress`, and nothing else on the screen changes when it does.

**Weekly goal lives in MMKV** (`store/readingGoal`), not on `user_settings`. Nothing
server-side reads it yet, and the shared-table contract is not worth spending on a
preference. `lib/streak.weekShortfall` is already the shape that write would take if
streak notifications are ever added, so `streakSnapshot` was not ported — there is no
server to snapshot to.

Swept out with it: `ReadStrip`, `CountBars`, and `reads.ts`'s `readsPerDay`,
`listeningStreak`, `localDateKey`, `readsSince` — all dead once the card stack went.
`topSpun`/`mostSpun` (Sonar's word for playing a record) became `topRereads`/`mostReread`
and now filter to two reads and up, surfaced as a "Read more than once" section.
Also fixed: `Segmented`'s active fill was still Sonar's emerald against Lidar's violet
border.

### Item 6 — Stats + page streak (original plan)

- Port `../radar/src/lib/stats.ts`, `statsPeriod.ts`, `streakSnapshot.ts` and
  `../radar/src/features/stats/` structure over Lidar's.
- **The streak is the new part.** Radar counts *completions* per week against a threshold
  the user picks. Lidar counts **pages** per week: every `book_reads` row contributes its
  `page_count`, and every forward move of `books.current_page` contributes the delta. That
  delta is why Item 7 has to store a page history — see §7.
- Weekly page target lives in Settings, defaulted to something forgiving (say 150).
- Keep `streakSnapshot`'s contract if notifications are ever added: the client computes,
  the server only warns.
- New stats worth having that Sonar's did not: pages this year, average pages per day,
  longest book, fastest finish, authors ranked by pages not by count.
- **Acceptance:** co-located `*.test.ts` for the streak maths, including a week that
  straddles a month boundary and a re-read of a different edition.

### Item 7 — The page tracker `feat/page-tracker` — **DONE 2026-09-06**

Built, plus the times-finished half the user asked for in the same pass.

- `public.book_progress` is the ledger (`page`, `pages_delta`, `read_id`, `recorded_at`).
  Every bookmark move writes a row; `books.current_page` stays the denormalised mirror.
  **`supabase/schema.sql` has to be re-run** — the table and `books.undated_reads` are not
  on the live project until it is.
- `lib/progress.ts` (24 tests) is the pure half: `resolveTypedPage` / `displayPage` for the
  mode, `pagesGained`, `planPageMove` for the whole field-to-write decision, and
  `closingMove` for what Finished bills.
- **Double counting is settled in `lib/streak.dailyPages`, not by trusting one source.**
  Finishing writes a closing ledger row for the pages between the bookmark and the last
  page, and a read is skipped when the ledger already has a row in the window since that
  book's previous finish. So a tracked book counts its length once, an imported or
  just-marked-finished book still counts as a lump, and a re-read that was never tracked
  still counts even though the first read was.
- The panel is two fields, per the user: last saved (uneditable) beside the new page, the
  receipt line under them, the sticky mode radio (`store/bookmarkMode`), Save and Finished.
  A backwards move is accepted and priced at zero rather than blocked with a dialog — the
  receipt says so in amber before it is saved.
- **Times finished is Radar's** (`../radar/src/lib/watchCounts.ts` and its watched box in
  `StatusPicker.tsx`): total = dated reads + undated. Lidar stores the *undated* half
  (`books.undated_reads`) and derives the total, because its dated half is the read log
  itself, so a stored total would need re-deriving on every insert and delete. `+` on the
  total logs a dated read now; `-` takes an undated one off first. No absorb rule — Radar
  absorbs because backfilling a date documents a past watch, and Lidar has no backfill
  surface, so a deliberate finish always adds one.
- Gap 3 in `STATUS.md` closed on the way past: `ReadHistory` no longer offers "Log a read",
  so a finish is recorded in exactly one place.

### Item 7 — The page tracker (original plan)

The feature the user described most precisely — build it exactly as written.

**The problem:** "what page are you on" is ambiguous. *Page 120* can mean "I finished 120"
or "I am about to read 120", and a book tracked one way one week and the other way the
next produces a page count that is quietly wrong — which then corrupts the streak in
Item 6.

**The design:**

1. `books.current_page` stores **the last page actually read**. One meaning, written down
   once, never inferred.
2. The input is **pre-filled with the last saved page**, so the user never counts or
   remembers. They overwrite it with where they are now.
3. Beside the field, a **plain-language notifier** that resolves the ambiguity out loud,
   and a toggle for which one they are typing:
   - *"Last page you finished"* → stored as typed.
   - *"Next page to read"* → stored as `typed − 1`.
   The toggle is sticky per user (an MMKV pref in `src/store/`), because people are
   consistent about which way they read a bookmark.
4. Echo the consequence under the field as they type: *"120 → 214. 94 pages since
   Tuesday."* That is the confirmation that they picked the right mode.
5. Guard rails: refuse a page above `page_count`; on a *backwards* move ask whether they
   are re-reading or fixing a typo, because a silent backwards jump would subtract pages
   from the streak.
6. **A page history is required.** A single `current_page` cannot answer "how many pages
   this week". Add `public.book_progress` (`id`, `user_id`, `book_id`, `book_key`, `page`,
   `pages_delta`, `recorded_at`) with the usual RLS pair, and write a row on every commit.
   `books.current_page` stays as the denormalised mirror, exactly as `last_read_at` mirrors
   `book_reads`.
7. Finishing a book writes a final progress row up to `page_count`, so a book finished in
   one sitting still counts its pages toward the streak.

- Rework `src/features/books/detail/ProgressPanel.tsx` around this; it currently just
  writes `current_page` with no history and no mode.
- **Acceptance:** pure functions for the mode conversion and the delta, tested. Typing the
  same physical position in either mode must produce the same stored `current_page`.

### Item 8 — Top 4 `feat/top-four`

- Settle §3 with the user first.
- Port `../radar/src/features/profile/FavoritesRow.tsx` and `FavoritesEditorSheet.tsx`.
- Show it on your own profile **and** on a public shelf (`u/[userId]`), as Radar does.
- **Acceptance:** pinning four books in Lidar leaves Radar's pinned films untouched —
  verify by reading `profiles.favorites` before and after.

### Item 9 — Polish ISBN coverage `feat/polish-isbn-source` — **DONE 2026-09-05, 2/3**

Built. `lib/googleBooks.ts` is now `lib/bookMetadata.ts` over an ordered
`lib/providers/` array — Biblioteka Narodowa **and e-ISBN** first for `978-83-…`. The two
Polish sources are complementary, not redundant: BN answered one of the three ISBNs and
e-ISBN answered a different one. See "Hit rate" in §9, including the TLS caveat on
e-ISBN and the Google 429 that may explain the original failures.

### Item 9 — Polish ISBN coverage (original plan)

**See §9 — it is the detailed spec for this item and supersedes the summary here.**
The short version: Polish editions are the coverage gap, Biblioteka Narodowa
(`data.bn.org.pl`) is the fix, and it is free and keyless.

**Blocked on the user** for the failing ISBNs (§2.3). Do not start it without them.

---

## 5. What must not break

- **The shared Supabase project.** `docs/shared-database.md` is the contract. No writing a
  table or column Radar or Sonar owns. `profiles.favorites` especially (§3).
- **`book_key` stays ISBN-first.** Ratings hang off it; changing the key strands every
  existing rating.
- **Never drop a column, table or row** in `supabase/schema.sql`. Retired fields go unused,
  not deleted.
- **Commits carry no self-attribution** — no `Co-Authored-By`, no generated-with footer.
- **`UPDATE.md` gets a bullet in the same commit** as each user-visible change, and
  `app.json`'s `expo.version` + `versionCode` move together once for the whole release
  (0.1.0 → 0.2.0, versionCode 2).
- **Build with JDK 21**, not the machine default 25 — see `STATUS.md` §3 step 4.

## 6. Suggested release shape

One `0.2.0`. Open the `## 0.2.0 — Unreleased` section in `UPDATE.md` at the start of
Item 1 and keep adding to it. Do not bump per item.

---

## 7. Page-tracker interaction, in full

Kept together here so it can be built without re-reading §4.

```
┌─────────────────────────────────────────────┐
│  Progress                                   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  214 / 384  56%   │
│                                             │
│  I'm on page  [ 214 ]                       │
│               ▲ pre-filled with last saved  │
│                                             │
│  ( • ) the last page I finished             │
│  (   ) the next page I'll read              │
│                                             │
│  120 → 214 · 94 pages since Tuesday         │
│                                             │
│              [ Save ]   [ Finished ]        │
└─────────────────────────────────────────────┘
```

- Pre-fill removes the counting. The user edits a number that is already right.
- The radio pair is the "notifier" — it says out loud which number is wanted, so the
  answer is unambiguous whichever way the user thinks about a bookmark.
- The running line is the receipt: wrong mode shows an off-by-one, and the user sees it.
- Sticky mode: whichever they pick is remembered, so after the first book it is one field
  and one tap.

---

## 8. Files that will change most

Rough map, to size the work before starting.

| Area | Files |
| --- | --- |
| Ownership strip | `types/book.ts`, `lib/formats.ts` (delete), `lib/bookStatus.ts`, `lib/libraryFacets.ts`, `features/books/add/FormatStatusPicker.tsx`, `features/books/detail/EditionDetails.tsx`, `supabase/schema.sql` |
| Covers | `components/media/*`, `features/settings/CardSizeControl.tsx` |
| Browse | `app/(tabs)/ratings.tsx` (delete), `features/ratings/*` (mostly delete), new `features/browse/*`, `components/layout/navDestinations.tsx`, `navActions.tsx`, `app/(tabs)/_layout.tsx` |
| Stats | `lib/stats.ts`, `lib/statsPeriod.ts`, new `lib/streak.ts`, `features/stats/*` |
| Page tracker | `features/books/detail/ProgressPanel.tsx`, new `lib/progress.ts`, new `store/progressMode.ts`, `hooks/useReads.ts`, `supabase/schema.sql` |
| Top 4 | new `features/profile/FavoritesRow.tsx` + editor, `hooks/useProfile.ts` or a new hook, `supabase/schema.sql` |
| ISBN | `lib/googleBooks.ts` → `lib/bookMetadata.ts`, new `lib/providers/*`, `features/books/add/IsbnScannerSheet.tsx` |

---

## 9. ISBN lookup — the Polish gap

Current chain: Google Books by ISBN-13 → Google Books by ISBN-10 → Open Library
`/api/books`. It misses a lot, and it misses **Polish editions worst of all**. That is the
gap this item closes; everything below targets Poland deliberately rather than adding
catalogues in general.

### Why Polish books fail today

Google Books indexes Polish publishers thinly and often holds only a scanned-preview
record with no ISBN attached, so `isbn:<n>` matches nothing. Open Library is
community-contributed and overwhelmingly anglophone — a mid-list Polish novel usually has
no edition record at all. Neither is going to improve. The fix is to query the catalogues
that are *obliged* to hold these books: Poland has legal deposit, so every book published
in Poland reaches the Biblioteka Narodowa, and every Polish ISBN is issued by the Polish
ISBN Agency. Those two between them should cover essentially the whole domestic shelf.

### Providers to add, in order

**1. Biblioteka Narodowa — `data.bn.org.pl`. Add this first; it is the whole point of the
item.**

Free, keyless, JSON, and it is the Polish national bibliography — legal deposit means it
holds Polish publications comprehensively, including the small presses and older printings
that Google has never heard of.

```
https://data.bn.org.pl/api/institutions/bibs.json?isbn=<isbn13>&limit=1
```

Notes for whoever builds it:

- The API also accepts `isbnIssn=`; if `isbn=` returns nothing for a book the user knows
  is Polish, try that before concluding the record is absent.
- Records come back MARC-shaped, not as tidy `title`/`authors` fields. Expect to read
  `title`, `author`, `publisher`, `publicationYear`, `pages` off the bib object and to do
  some cleaning: BN writes authors as `"Nazwisko, Imię (1921-2006)"`, so strip the life
  dates and flip to `"Imię Nazwisko"` before it reaches `authorList`. The page count
  arrives as a statement of extent like `"318, [2] s."` — parse the leading integer.
- **No cover images.** BN's bib records carry no jacket art. Fall back to Google Books or
  Open Library *for the cover only* when BN supplied the text — the providers do not have
  to be all-or-nothing, and a Polish book with correct metadata and a blank cover is a
  worse result than it needs to be.
- Diacritics come through as proper UTF-8; `bookKey`'s `UNDECOMPOSABLE` map already
  handles `ł`, so slugging is fine.

**2. e-ISBN — the Polish ISBN Agency register (`e-isbn.pl`), run by the BN.**

This is the registry a Polish publisher files with *when it assigns the ISBN*, so it has
records for books that are brand new, self-published, or otherwise not yet in the national
bibliography — precisely the tail that item 1 will still miss. Free.

There is no documented JSON API. Check whether the site's search backend returns JSON
before committing to it; if it only renders HTML, **stop and ask the user** rather than
scraping — a brittle scrape inside a barcode scanner is worse than an honest "not found"
that drops into the add-by-hand form.

**3. NUKAT — the union catalogue of Polish academic libraries.**

Free, SRU/Z39.50 at `nukat.edu.pl`. Worth adding only if the user's failures include
textbooks, scholarly titles or Polish translations of academic work; it adds little for
fiction. Treat as optional.

### Deliberately not doing

- **Library of Congress, Deutsche Nationalbibliothek** — strong catalogues, wrong country.
  Revisit only if the user's shelf turns out to have a German or American gap too.
- **ISBNdb** — the best aggregate coverage available, but paid, and its Polish holdings
  are secondhand anyway. The free Polish sources should be measured first.
- **Goodreads** (API retired 2020), **Amazon PA-API** (needs an affiliate account in good
  standing), **WorldCat** (keys issued to institutions).

### Method

**Before writing any provider, get the failing ISBNs from the user.** Ask for three to
five books that come back "not in either catalogue" today — the point of this item is
those specific books, not coverage in the abstract.

Then, in order:

1. Probe `data.bn.org.pl` with those ISBNs **by hand first** (`curl`), and read the actual
   JSON. The field notes above are written from how the API is shaped generally and
   **have not been verified against a live response** — confirm them before coding against
   them.
2. Build the provider, re-run the same ISBNs, and record the hit rate in this file.
3. Only then decide whether e-ISBN or NUKAT is needed. If BN resolves all of them, stop —
   one good provider beats three speculative ones.

### Shape of the change

- `src/lib/googleBooks.ts` → **`src/lib/bookMetadata.ts`**; it is no longer just Google.
- `lookupIsbn(isbn)` stays the single entry point, so the scanner, the search box and
  `useEditBookForm`'s refresh all pick this up for free.
- Providers become an ordered array of `(isbn) => Promise<BookResult | null>` under
  `src/lib/providers/` — `googleBooks.ts`, `openLibrary.ts`, `bibliotekaNarodowa.ts` —
  each pure apart from `fetch` and testable against a recorded response fixture.
- **Polish-first ordering when the ISBN is Polish.** An ISBN-13 beginning `97883` is a
  Polish registration group (`978-83-…`), so put BN at the front of the chain for those and
  leave Google first otherwise. That one check makes the common case fast and correct
  instead of waiting on two misses.
- A provider that throws must never stop the chain — that is already the behaviour; keep it.
- Show which catalogue answered on the scan confirmation card, so a wrong record is
  traceable to its source.
- When nothing answers, the add-by-hand path already carries the ISBN. Verify that still
  holds.

**Acceptance:** the specific ISBNs the user supplied resolve, with correct Polish
diacritics in the author and title, and the hit rate is written down here.

---

### Hit rate — measured 2026-09-05 against the live APIs

| ISBN | Google Books | Open Library | Biblioteka Narodowa | e-ISBN |
| --- | --- | --- | --- | --- |
| 978-83-08-06856-4 | *untested, 429* | miss | miss | miss |
| 978-83-66324-20-6 | *untested, 429* | miss | **HIT** | miss |
| 978-83-8196-545-3 | *untested, 429* | miss | miss | **HIT** |

**The two Polish sources together closed 2 of 3**, and they closed different ones — which
is the case for keeping both. BN holds what has been *published* (legal deposit); e-ISBN
holds what has been *registered*, which is the newer and smaller-press tail.

Both hits resolve completely and correctly:

- BN, 978-83-66324-20-6 — "Fight club" / "podziemny krąg", Chuck Palahniuk (the
  translator Lech Jęczmyk correctly *not* credited), Niebieska Studnia, 2020, 246 pages,
  polski.
- e-ISBN, 978-83-8196-545-3 — "Dżuma", Albert Camus (the translator Joanna Guze correctly
  *not* credited), Państwowy Instytut Wydawniczy, 2022-11-30, polski.

Diacritics come through as proper UTF-8 in both (`D\xc5\xbcuma` on the wire), and
`bookKey`'s `UNDECOMPOSABLE` map handles them.

### What the plan got wrong about BN

The §9 field notes were written from how the API is shaped generally and, as §9 itself
warned, had never been checked. Two of them are actively dangerous:

- **`isbn=` is silently ignored.** It does not error and it does not return nothing — it
  returns *the first record in the zone*. `?isbn=9788308068564` came back as an unrelated
  2002 biography of Mother Teresa. A provider written against `isbn=` would hand the
  scanner a confidently wrong book, which is worse than a miss. **`isbnIssn=` is the
  parameter**, and it is honoured. So is `title=`; `search=` is ignored the same way
  `isbn=` is. Unknown parameters are dropped without complaint — that is the trap.
- **The convenience fields are unusable.** `title`, `author` and `publisher` are
  space-joined concatenations of every variant on the record: a title arrives as
  `"Fight club : podziemny krąg / Podziemny krąg Fight club"`, an author as
  `"Palahniuk, Chuck (1962- ) Jęczmyk, Lech (1936-2023) Wydawnictwo Niebieska Studnia"` —
  novel, translator and publisher in one string with no separator to split on. Everything
  has to be read out of `marc.fields` instead (245 $a/$b, 100/700 $a with $e for the role,
  260/264 $b, 300 $a). `genre` is the same blob, so genres are dropped rather than guessed.
- Right in the notes: no cover art, page count as a statement of extent (`"246, [1]
  strona ;"` as well as the predicted `"318, [2] s."`), and authors as
  `"Nazwisko, Imię (dates)"` needing the dates stripped and the name flipped.
- `isbnIssn` is stored digits-only and carries **every binding's ISBN on one record**
  (`"9788366324046 9788366324206"`), so the hardback and the paperback resolve to the
  same bib.

### e-ISBN — what the plan did not know existed

§9 checked the e-isbn.pl *search page*, found a jQuery form `POST` to
`/IsbnWeb/start/search.html` returning server-rendered HTML, and said to stop and ask
rather than scrape. That was the right call about the wrong thing: there is a real,
documented API alongside it, registered on Poland's open-data portal as dataset 3178 —
`https://e-isbn.pl/IsbnWeb/api.xml`, ONIX 3.0, free and keyless, sender `bnisbn@bn.org.pl`.
No scraping involved.

Notes for whoever touches it next:

- **`isbn` is the only parameter that filters.** `isbn13`, `productIdentifier` and
  `search` are all silently ignored and hand back the first page of the bulk export —
  the same trap BN sets with the opposite spelling, so the provider checks the returned
  `ProductIdentifier` against the ISBN it asked for before believing a hit.
- Plain ISBN-13 and the hyphenated form both work; ISBN-10 does not.
- ONIX codes that matter: `ProductIDType` 15 = ISBN-13 / 02 = ISBN-10, `TitleType` 01 is
  the distinctive title, `ContributorRole` A01 is the author (B06 is a translator and is
  skipped), `PublishingDateRole` 01 is publication, `ExtentType` 00/11 is the page count.
- No cover art here either, so `bookMetadata` borrows one from Google or Open Library —
  and **for a Polish book that borrow almost always fails too**: Open Library's cover API
  404s on all three ISBNs and Google is rate-limited. Verified there is nothing to fetch:
  zero `CollateralDetail` / `SupportingResource` across every product in the e-ISBN
  sample, and no 856 or URL field on the BN record. These are bibliographic registers,
  not shop listings. So a coverless book now draws its own cover
  (`components/media/GeneratedCover`, seeded off `bookKey`) and the book page offers a
  photo picker (`features/books/detail/CoverPicker`) storing a 320px JPEG data URI in
  `books.cover_url`, the same inline trick `profiles.pfp` uses.
- React Native has no DOMParser, so `providers/onix.ts` is a purpose-built tag scanner
  over a single `<Product>`, not an XML parser, and says so. 10 tests against the
  recorded Camus response.
- **Incomplete TLS chain** — see open question §2.5. This may not work on Android at all.

### The third ISBN, and why it is still missing

`978-83-08-06856-4` is absent from BN, e-ISBN and Open Library, and from BN under its
ISBN-10 form (`8308068561`). `978-83-08-…` is Wydawnictwo Literackie, so this is not an
obscure self-published book — it is simply not catalogued under this number in any free
source reachable from here. **Google Books is the remaining candidate and could not be
measured** (see below).

**NUKAT** was not reachable at all: `sru.nukat.edu.pl` does not resolve over http or
https. §9 already rated it optional and fiction-irrelevant; nothing here changes that.

### Google Books is currently rate-limited from this network

Every anonymous `volumes` call returned **429, "Quota exceeded ... Queries per day"**, so
Google's column above could not be measured. `EXPO_PUBLIC_GOOGLE_BOOKS_KEY` is
deliberately blank (STATUS §3 step 1) and the anonymous quota is shared per IP.

**This may be the whole story behind the reported failures.** If Google was 429ing when
those three books were scanned, they would have come back "not in either catalogue"
regardless of whether Google holds them. Setting a (free) Google Books API key in `.env`
is the cheapest next thing to try, and it should be tried before any more catalogues are
added.
