# One database, three apps

Radar (films), Sonar (records) and Lidar (books) run on the **same Supabase project**. Not
copies, not a sync — the same rows. This is a deliberate constraint: the free plan is one
project, and all three apps belong to the same person, so the alternative was three
accounts and three friend lists for one human.

The cost is a coupling that has to be respected. This file is Lidar's half of the
contract; `../../sonar/docs/shared-database.md` is Sonar's, and says the same things.

## What is shared

| Table / function | Owner | Lidar's use |
| --- | --- | --- |
| `public.profiles` | Radar | Read; writes username / display name / avatar. **Never** touches `favorites`. |
| `public.friendships` | Radar | Read; writes via the RPCs below. |
| `public.friend_requests` | Radar | Read; inserts its own requests. |
| `public.user_settings` | Radar | Reads and writes **only** `friends_visibility` and `theme`. |
| `private.can_view(uuid)` | Radar | Every Lidar read policy calls it. |
| `accept_friend_request`, `decline_friend_request`, `remove_friend`, `can_view_user` | Radar | Called as-is. |

Consequences worth stating plainly, because they are user-visible:

- **One identity.** Renaming yourself or changing your avatar in Lidar renames you in
  Radar and Sonar. The login is the same login — the same Google account, the same
  session cookie on web.
- **One friend list.** Accepting a request in any of the three makes you friends in all
  three. A friend you remove is removed everywhere.
- **One privacy switch.** `friends_visibility` gates the film shelf, the record shelf and
  the bookshelf together. "Friends only" meaning three different things in three apps
  would be a way to leak a shelf you thought you had closed, so it deliberately does not.
- **One theme preference.** `user_settings.theme` is shared for the same reason.

## What is Lidar's own

`books`, `book_reads`, `book_ratings`, `book_activity`, `book_activity_reactions`,
`book_activity_comments`. All created by `supabase/schema.sql`, all RLS'd with the same
owner-writes / visible-reads shape Radar and Sonar use.

### Why not reuse `public.movies` or `public.albums`

A book is not a shaped-down film or record — it has authors, an ISBN, a page count, an
edition, a reading position — and more decisively, both sibling clients do `select *` on
their own tables and normalize every row through their own boundary
(`normalizeMovie`, `normalizeAlbum`). Book rows landing there would render as broken films
in Radar and broken albums in Sonar. Separate tables cost one extra query and keep all
three clients honest.

### Why ratings are their own table

`book_ratings` is keyed `(user_id, book_key)` and has **no foreign key** to `books`. That
is what makes the headline feature work: you can rate a book you do not own — a library
loan, a friend's copy, something you only ever read on a train — and the score survives
removing the book from your shelf and adding it back later.

`book_key` is the identity of the *edition* (`src/lib/bookKey.ts`), in preference order:

| Shape | When |
| --- | --- |
| `isbn:<isbn13>` | The edition has an ISBN. This is the usual case and always what a barcode scan produces. |
| `gbooks:<volumeId>` | Google Books knows it but it carries no ISBN — older books, some self-published editions. |
| `manual:<slug(first author)>\|<slug(title)>` | Typed by hand, keyed by what was typed. |

ISBN wins over the Google volume id deliberately: one edition has one ISBN but several
volume ids across Google's regional catalogues, so keying on the volume would let one
physical book be rated twice. An ISBN-10 is normalised up to its 13-digit form first
(`src/lib/isbn.ts`), so typing the number off a copyright page and scanning the barcode
land on the same key.

### The extra status

Lidar's `status` CHECK carries `Reading` and `Did not finish` where the siblings have only
`Collection`/`Wishlist`/`Pre-order`. A record is spun in an evening; a book is lived with
for weeks, so the shelf has to be able to say which one is open on the nightstand.
`books.current_page` is the live bookmark that goes with it, and finishing a book clears
it while writing a `book_reads` row.

## Rules for changing anything

1. Run Radar's `supabase/schema.sql` first on a fresh project. Lidar's file opens with a
   prerequisite check and raises a readable error if the shared tables are missing.
2. All three files are idempotent and applied by hand through the SQL editor. None drops
   anything.
3. A new column goes in as `alter table ... add column if not exists` under the COLUMN
   MIGRATIONS heading, not by editing a `create table` — the create is skipped on a live
   database.
4. Adding a column to a shared table is allowed (the siblings ignore columns they do not
   know) but writing one Radar owns is not. Lidar's sparse upsert of `user_settings` is
   written the way it is so it cannot clobber Radar's notification and streak columns.
5. If a change would make Radar or Sonar render or write something wrong, it belongs in a
   Lidar-owned table instead.

## Performance note

The three apps query different tables, and the only shared reads are profile rows and the
friend list, both small and cached for minutes. The realtime channels are per-user
filtered, so no app wakes for another's writes.

The one place to watch is `book_activity`'s realtime subscription
(`features/social/useFriendActivity`), which cannot filter on "user_id in (…)" and so
wakes on every insert to that table. It is Lidar's own table, so only Lidar's writes hit
it, and the handler only invalidates a query — but if the feed ever gets busy, that is the
thing to narrow.
