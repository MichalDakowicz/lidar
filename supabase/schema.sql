-- Lidar — schema, RLS and realtime, on the SAME Supabase project as Radar and
-- Sonar.
--
-- WHY ONE PROJECT: a free Supabase plan is one project, and the three apps are
-- the same person's account either way. Everything about *who you are* is
-- shared and is NOT re-created here — public.profiles, public.friendships,
-- public.friend_requests, public.user_settings, private.can_view() and the
-- accept/decline/remove friend RPCs all come from Radar's supabase/schema.sql.
-- Run that file first (it is idempotent); this one only adds what books need.
--
-- WHY SEPARATE TABLES rather than reusing public.movies / public.albums: a book
-- is not a shaped-down film or record (authors, pages, editions, an ISBN), and
-- both sibling clients select `*` from their own tables and normalize every row
-- as their own kind of thing. Book rows landing there would render as broken
-- films in Radar and broken albums in Sonar.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste the whole
-- file → Run. Idempotent: every statement is `if not exists`, `create or
-- replace`, or a guarded do-block, so re-running only applies what is missing.
-- It never drops a table, a column or a row.

-- ============================================================================
-- PREREQUISITE CHECK — fail loudly rather than half-creating a broken schema.
-- ============================================================================

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Run Radar''s supabase/schema.sql first: public.profiles is missing (Lidar shares it).';
  end if;
  if to_regprocedure('private.can_view(uuid)') is null then
    raise exception 'Run Radar''s supabase/schema.sql first: private.can_view() is missing (Lidar shares it).';
  end if;
end $$;

-- ============================================================================
-- SCHEMA
-- ============================================================================

-- Reading status is free text with a CHECK rather than an enum: the list lives
-- in the client (lib/bookStatus.ts) and gains entries faster than a Postgres
-- type should be altered.
--
-- NOTE: the create table below still carries the 0.1.0 status list and the
-- retired ownership columns. Neither is edited, because on a live database the
-- create is skipped entirely and an edit here would silently do nothing — the
-- 0.2.0 CHECK is applied by the COLUMN MIGRATIONS block further down, which
-- runs on a fresh database and an existing one alike.

create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Text, not bigint: an ISBN-10 can end in 'X', and leading zeroes are part of
  -- the number. Stored digits-only, hyphens stripped by lib/isbn.ts.
  isbn13        text,
  isbn10        text,
  -- Google Books volume id, for an edition with no ISBN (older books, some
  -- self-published ones) or when the scan matched a volume before an ISBN.
  google_id     text,
  -- Identity of the *edition*, not of this row: 'isbn:<isbn13>' when known,
  -- else 'gbooks:<volumeId>', else 'manual:<author>|<title>' (lib/bookKey.ts).
  -- It is what joins an owned book to a rating, and what lets a rating exist
  -- with no book row behind it at all.
  book_key      text not null,
  title         text not null,
  subtitle      text,
  -- string[] — a book can credit several authors and the library filters on
  -- each of them, so this is a list, never a joined string.
  authors       jsonb not null default '[]',
  cover_url     text,
  -- Text, not date: Google Books returns year / year-month / full-date
  -- precision and '1969' must survive a round trip.
  published_date text,
  page_count    int,
  publisher     text,
  language      text,
  series        text,
  series_index  numeric,
  genres        jsonb not null default '[]',
  description   text,
  url           text,
  -- Copies owned of this one edition. Physical or not — "Ebook" is a format.
  formats       text[] not null default '{}',
  status        text not null default 'Library'
                  check (status in ('Library','Reading','Wishlist','Pre-order','Did not finish')),
  notes         text,
  favorite_quotes text,
  acquisition_date date,
  store_name    text,
  price_paid    numeric,
  edition       text,
  -- The first page of the story. Front matter, a foreword and a translator's
  -- note are pages you did not read, and a 384-page book that opens on 17 is
  -- 368 pages of reading — so this is the floor every page sum counts from, and
  -- the floor the progress bar starts at. Null means "starts on page 1".
  start_page    int,
  -- Where you are in it right now. The read log below is the history; this is
  -- the live bookmark, so the Library can show a progress bar without pulling
  -- every read row.
  current_page  int,
  progress_updated_at timestamptz,
  -- Manual shelf order (drag to reorder). Sparse doubles, so a move only
  -- rewrites the row that moved.
  custom_order  double precision,
  -- Derived mirror of the newest public.book_reads row for this book. Kept
  -- denormalized because a friend's shelf reads books alone, without pulling
  -- the other person's whole read log (written by hooks/useReads).
  last_read_at  timestamptz,
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists books_user_id_idx          on public.books (user_id);
create index if not exists books_user_id_status_idx   on public.books (user_id, status);
create index if not exists books_user_id_added_at_idx on public.books (user_id, added_at desc);
-- Scanning a barcode looks the shelf up by ISBN before it hits the network, so
-- the "you already own this" check is an index hit, not a table scan.
create index if not exists books_user_id_isbn13_idx   on public.books (user_id, isbn13);

-- UNIQUE, not just an index: one row per edition per person. Reading the same
-- book twice is two public.book_reads rows against one books row, never two
-- books rows — and the uniqueness is also what `on conflict (user_id,
-- book_key)` needs, which is how the JSON import avoids doubling a shelf on a
-- second run.
create unique index if not exists books_user_id_book_key_key on public.books (user_id, book_key);

-- One row per finished read. The log is the source of truth; books.last_read_at
-- is its mirror. book_key is copied in so a read survives the book row being
-- deleted from the library (you still read it).
create table if not exists public.book_reads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_id     uuid references public.books(id) on delete set null,
  book_key    text,
  title       text not null,
  authors     jsonb not null default '[]',
  cover_url   text,
  started_at  timestamptz,
  finished_at timestamptz not null default now(),
  -- Pages at the time of the read, so a re-read of a different edition still
  -- counts the right number toward the year's page total.
  page_count  int
);

create index if not exists book_reads_user_id_finished_at_idx on public.book_reads (user_id, finished_at desc);
create index if not exists book_reads_book_id_idx             on public.book_reads (book_id);

-- Ratings hang off the *book*, not off ownership: rating something you do not
-- own (a library loan, a friend's copy, a search result) is the point, so this
-- table has no FK to public.books. An owned book finds its rating by book_key,
-- and keeps it if the book is later removed and re-added.
--
-- `ratings` is jsonb in the same shape Radar and Sonar use, so the scoring rule
-- (lib/personalScore.ts) is literally the same function in all three apps.
create table if not exists public.book_ratings (
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_key    text not null,
  isbn13      text,
  -- Snapshot of what was rated, for the same reason profiles.favorites is a
  -- snapshot: the rating has to render on its own, with no book row to join.
  title       text not null,
  authors     jsonb not null default '[]',
  cover_url   text,
  published_date text,
  ratings     jsonb not null default '{}',
  review      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, book_key)
);

create index if not exists book_ratings_user_id_idx on public.book_ratings (user_id);
-- The ratings-distribution curve and the "rating" sort read the overall score.
create index if not exists book_ratings_user_id_overall_idx
  on public.book_ratings (user_id, ((ratings->>'overall')::numeric));

-- Lidar's own activity log, mirroring public.activity / public.album_activity.
create table if not exists public.book_activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  book_id    uuid references public.books(id) on delete set null,
  book_key   text,
  book_title text not null,
  type       text not null,
  details    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists book_activity_user_id_created_at_idx
  on public.book_activity (user_id, created_at desc);

-- Reactions and comments on a book activity row, same contract as the siblings':
-- kind is a short code, not the emoji glyph, so the CHECK is not a unicode
-- normalisation puzzle (the client maps code -> glyph in lib/socialFeed.ts).
create table if not exists public.book_activity_reactions (
  activity_id uuid not null references public.book_activity(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('fire','eyes','heart')),
  created_at  timestamptz not null default now(),
  primary key (activity_id, user_id, kind)
);
create index if not exists book_activity_reactions_activity_id_idx
  on public.book_activity_reactions (activity_id);

create table if not exists public.book_activity_comments (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.book_activity(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists book_activity_comments_activity_id_created_at_idx
  on public.book_activity_comments (activity_id, created_at);

-- ============================================================================
-- COLUMN MIGRATIONS — for a database created by an earlier run of this file.
-- The CREATE TABLEs above are skipped entirely once the tables exist, so every
-- column added later has to be repeated here as an `add column if not exists`.
-- Add them below, newest last, and never edit a create table.
-- ============================================================================

-- 0.2.0 — reading-lifecycle statuses, replacing the ownership ones.
--
-- Lidar tracks reading, not a shelf of objects, so Library / Wishlist /
-- Pre-order are gone and Readlist / Read take their place. Postgres cannot
-- widen a CHECK in place: it has to be dropped, the rows moved off every
-- retired value, and the constraint re-added — in that order, or the re-add
-- fails on the rows it is meant to be validating.
--
-- Which value a retired row lands on is decided by the read log's mirror: a
-- book with a finished read behind it was read, and anything else is still to
-- be read. That is the same rule lib/dataTransfer applies to an old export.
--
-- Idempotent: dropping the constraint is `if exists`, the updates match no rows
-- on a second run, and re-adding is guarded on the constraint being absent.
do $$
begin
  alter table public.books drop constraint if exists books_status_check;

  update public.books
     set status = 'Read'
   where status in ('Library', 'Wishlist', 'Pre-order')
     and last_read_at is not null;

  update public.books
     set status = 'Readlist'
   where status in ('Library', 'Wishlist', 'Pre-order');

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.books'::regclass and conname = 'books_status_check'
  ) then
    alter table public.books
      add constraint books_status_check
      check (status in ('Readlist', 'Reading', 'Read', 'Did not finish'));
  end if;

  alter table public.books alter column status set default 'Readlist';
end $$;

-- 0.2.0 — where the story starts.
--
-- Books rarely open on page 1. Counting a 384-page book that begins on 17 as
-- 384 pages read inflates every page total and every streak day it lands on.
-- Null keeps the old behaviour (start at 1), so no existing row changes meaning.
alter table public.books add column if not exists start_page int;

-- A start page past the end is not a start page. Guarded so a re-run is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.books'::regclass and conname = 'books_start_page_check'
  ) then
    alter table public.books
      add constraint books_start_page_check
      check (start_page is null or start_page >= 1);
  end if;
end $$;

-- Retired in 0.2.0 and deliberately NOT dropped: this file never drops a
-- column, an old export may still carry these, and a column nothing writes
-- costs nothing to keep.
--   public.books.formats, .price_paid, .store_name, .acquisition_date, .edition

-- ============================================================================
-- RLS — the same two-policy shape the siblings use: owner writes, visible reads.
-- private.can_view(target) is Radar's and reads user_settings.friends_visibility,
-- so one privacy switch governs all three apps. That is deliberate: it is one
-- profile, and "friends only" meaning three different things in three apps
-- would be a way to leak a shelf you thought was closed.
-- ============================================================================

create or replace function private.can_view_book_activity(target uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.book_activity a
    where a.id = target and private.can_view(a.user_id)
  );
$$;
revoke all on function private.can_view_book_activity(uuid) from public;
grant execute on function private.can_view_book_activity(uuid) to authenticated, anon;

alter table public.books                    enable row level security;
alter table public.book_reads               enable row level security;
alter table public.book_ratings             enable row level security;
alter table public.book_activity            enable row level security;
alter table public.book_activity_reactions  enable row level security;
alter table public.book_activity_comments   enable row level security;

-- CREATE POLICY has no `if not exists`, so each is dropped and re-created. The
-- pair runs inside the SQL Editor's single transaction — no unprotected window.
drop policy if exists books_owner_all on public.books;
create policy books_owner_all on public.books for all
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists books_visible_read on public.books;
create policy books_visible_read on public.books for select
  to anon, authenticated using (private.can_view(user_id));

drop policy if exists book_reads_owner_all on public.book_reads;
create policy book_reads_owner_all on public.book_reads for all
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists book_reads_visible_read on public.book_reads;
create policy book_reads_visible_read on public.book_reads for select
  to anon, authenticated using (private.can_view(user_id));

drop policy if exists book_ratings_owner_all on public.book_ratings;
create policy book_ratings_owner_all on public.book_ratings for all
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists book_ratings_visible_read on public.book_ratings;
create policy book_ratings_visible_read on public.book_ratings for select
  to anon, authenticated using (private.can_view(user_id));

drop policy if exists book_activity_visible_read on public.book_activity;
create policy book_activity_visible_read on public.book_activity for select
  to anon, authenticated using (private.can_view(user_id));
drop policy if exists book_activity_owner_write on public.book_activity;
create policy book_activity_owner_write on public.book_activity for insert
  to authenticated with check ((select auth.uid()) = user_id);

-- React/comment on anything you may see; take back only your own. No update
-- policy on either: a reaction toggles by delete, a comment is post-or-delete.
drop policy if exists book_reactions_visible_read on public.book_activity_reactions;
create policy book_reactions_visible_read on public.book_activity_reactions for select
  to authenticated using (private.can_view_book_activity(activity_id));
drop policy if exists book_reactions_owner_write on public.book_activity_reactions;
create policy book_reactions_owner_write on public.book_activity_reactions for insert
  to authenticated with check (
    (select auth.uid()) = user_id and private.can_view_book_activity(activity_id)
  );
drop policy if exists book_reactions_owner_delete on public.book_activity_reactions;
create policy book_reactions_owner_delete on public.book_activity_reactions for delete
  to authenticated using ((select auth.uid()) = user_id);

drop policy if exists book_comments_visible_read on public.book_activity_comments;
create policy book_comments_visible_read on public.book_activity_comments for select
  to authenticated using (private.can_view_book_activity(activity_id));
drop policy if exists book_comments_owner_write on public.book_activity_comments;
create policy book_comments_owner_write on public.book_activity_comments for insert
  to authenticated with check (
    (select auth.uid()) = user_id and private.can_view_book_activity(activity_id)
  );
drop policy if exists book_comments_owner_delete on public.book_activity_comments;
create policy book_comments_owner_delete on public.book_activity_comments for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ============================================================================
-- REALTIME — the library, the read log and the feed all live-update.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['books','book_reads','book_ratings','book_activity',
                           'book_activity_reactions','book_activity_comments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
