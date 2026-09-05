# Lidar 0.2.0 — align with Radar

**This is the work order for the next session. Read it with `STATUS.md` and nothing else
is needed.** `STATUS.md` says where the app stands today; this says where it is going and
in what order. Tick items off here as they land, and move anything finished into
`STATUS.md` §2.

Written 2026-09-05, before any of it was coded. **Items 1, 2 and 3 are done**
(2026-09-05); Items 4-9 are still untouched.

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
3. **The failing ISBNs** — still open, and §9 cannot be started without them. Three to
   five real ISBNs that come back "not in either catalogue" today. Ask for them first;
   they are the test cases. (Everything recommended in §9 is free and keyless, so there
   is no paid decision to make unless the Polish sources fall short.)

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

### Item 5 — Browse replaces Ratings `feat/browse-tab`

The biggest UI item. Ask the open question from §2.1 first.

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

### Item 6 — Stats + page streak `feat/reading-stats`

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

### Item 7 — The page tracker `feat/page-tracker`

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

### Item 9 — Polish ISBN coverage `feat/polish-isbn-source`

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
