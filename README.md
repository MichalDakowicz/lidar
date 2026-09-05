# Lidar

**Point it at a spine and it knows the book.**

Lidar tracks a book collection — hardcover, paperback, ebook, audiobook — across a native
Android app and the web, on the same account as
[Radar](https://github.com/MichalDakowicz/radar) (films) and
[Sonar](https://github.com/MichalDakowicz/sonar) (records).

## Features

- **Scan the barcode.** The EAN-13 on a back cover *is* the ISBN, so pointing the camera
  at it identifies the exact edition — not whichever printing a title search ranked
  highest. Falls back to a typed ISBN, and to a hand-written entry when neither catalogue
  has it.
- **Your shelf, your order.** Filter by format, author, genre, year, publisher or status;
  group by any of them; sort by shelf order, rating, last finished or price.
- **Rate anything.** Four facets (prose, plot, characters, re-read) plus an overall score
  — and ratings hang off the *book*, so you can rate a library loan you never owned, or
  keep the score after giving your copy away.
- **Reading, not just owning.** A `Reading` status and a page bookmark, because a book is
  lived with for weeks. Finishing writes a row to the read log and clears the bookmark.
- **Wishlist and pre-orders** alongside what you actually have, without polluting the
  numbers: every library stat counts owned books only.
- **Edition details.** Publisher, edition note, store, price paid, acquisition date,
  favourite passages, notes.
- **Ratings page.** A tier list of everything you have an opinion about. Search any book
  and drop it into S–F in one tap — owning it is never required.
- **Social.** Friends' activity feed with reactions, friend requests, and a public shelf
  you can share by link — one friend list shared with Radar and Sonar.
- **Stats.** Pages and books finished, format split, top authors, eras, genres, where
  books came from, what you have spent, and the shape of how you rate.

## Tech

React Native / Expo (SDK 57), Expo Router, NativeWind, Supabase (Postgres + RLS +
realtime), TanStack Query, Zustand + MMKV, FlashList, Reanimated, expo-camera for the
barcode scan. Metadata comes from Google Books with Open Library as a fallback — neither
needs credentials.

The app is built on Radar and Sonar's skeleton — the same nav islands, sheet primitives,
theme tokens and layering conventions — so a component moves between the three projects
without restyling. Only the accent differs: violet (`#8B5CF6`) here, blue in Radar,
emerald in Sonar.

## Getting started

```sh
npm install
cp .env.example .env     # then fill it in
npm start
```

`.env` needs:

| Variable | Why |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The shared Supabase project — copy them out of `../radar/.env` |
| `EXPO_PUBLIC_GOOGLE_BOOKS_KEY` | Optional. Only raises the per-IP quota; searches work without it |

### Database

Run Radar's `supabase/schema.sql` first if the project is fresh, then this repo's
`supabase/schema.sql` — Supabase Dashboard → SQL Editor → paste → Run. Both are
idempotent. See [docs/shared-database.md](docs/shared-database.md) for what is shared and
the rules for changing it.

### Android

```sh
npx expo run:android --device      # dev build
npx expo prebuild -p android       # after app.json / native changes
cd android && ./gradlew assembleRelease
```

The barcode scanner needs a real build — it will not run in Expo Go, because
`expo-camera`'s native module is not in that binary.

### Web

```sh
npm run deploy:web    # expo export -p web && firebase deploy --only hosting
```

The camera is native-only: the web build opens the scanner straight to its typed-ISBN
field, which is the same code path from the moment a number exists.
