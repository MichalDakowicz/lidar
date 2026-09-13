# Update notes

See `UPDATE-schema.md` for how to write these.

## 1.1.1 — Unreleased

### Changed
- Sign-in screen names Pulsar too, so all four apps point at the one account

## 1.1.0 — 2026-09-09

### Added
- Reset beside Save page clears the bookmark for a re-read, keeping every page you read

### Changed
- Saving the last page finishes the book itself, counting the pages that were left
- A finished book keeps its progress bar full instead of emptying it
- Removing a book sits at the bottom of the book page instead of on top of the jacket

### Removed
- The Finished button on the book page — the times finished box above it is the one way

## 1.0.0 — 2026-09-06

### Added
- Scanning a Polish book now checks Biblioteka Narodowa and e-ISBN, which Google misses
- A book no catalogue has a jacket for gets a cover drawn from its title, not a blank square
- Put your own photo on a book's cover from the book page
- Scan card says which catalogue answered, so a wrong record is traceable
- A scan no catalogue knows can be added by hand keeping its ISBN, so a later rating finds it
- Reading streak counts pages a week, so a long novel keeps it alive as well as a short one
- Stats gets a six-month reading calendar, shaded by how much you read each day
- Weekly page goal in Settings, defaulting to 150 — typed, with ±1, ±5 and ±10 either side
- Stats adds pages this year, pages a day, longest book and authors ranked by pages
- Masterpieces on Stats: every book you have rated a perfect 5
- Browse tab: search any book, and rows built from the authors and subjects you read
- Add a book straight from a Browse row or a search result, without opening it
- Set which page a book's story starts on, so front matter stops counting as pages read
- Restart the reading streak from today in Settings, keeping every book you have read
- Saving a page now counts towards the streak and the calendar, not just the progress bar
- Progress panel shows the last saved page beside the new one, with the pages the move is worth
- Settings says whether you type the page you finished or the one you will read next
- Times finished on the book page, with a count for books you read before you tracked them

### Changed
- Sign-in screen names both siblings, Radar and Sonar, as the same account
- Stats is laid out as sections rather than a stack of cards, so the big numbers lead
- Most-read authors are ranked by pages read, not by how many of their books you own
- Covers are rectangular, the shape a book jacket actually is, everywhere in the app
- Library fits fewer, larger covers across the grid, so a title is readable at a glance
- An odd-shaped cover is shown whole against a blur instead of having its title cropped off
- Library tab icon is a bookshelf, not a vinyl record
- Books are tracked by reading, not owning: Readlist, Reading, Read and Did not finish
- Library rail is now Readlist, holding what you mean to read next
- Stats count books you have opened, and break out readlist, reading and unfinished
- Finishing a book marks it Read whatever it was before, including straight off the readlist
- Read history is logged from the times-finished box, so a finish is recorded in one place
- A book's length and the page its story starts on sit with the page counter, not under your notes

### Removed
- Ratings tab and its S-F tier board are gone — rate a book on the book page instead
- Library drops the Recently finished rail — the shelf itself is the answer
- Formats are gone — no more Hardcover, Paperback, Ebook or Audiobook on a book
- Book page no longer asks what you paid, where you bought it, or the edition
- Covers lose the play button — finishing a book is the times-finished box on the book page
- Library filters drop Format, and sorting drops Price paid
- Stats drop the format split, where books came from, and what you spent
- Stats drop the daily reads strip, replaced by the reading calendar

## 0.1.0 — Unreleased

### Added
- Add a book by scanning the barcode on its back cover, or by typing its ISBN
- Search books by title, author or ISBN and add them to Library, Reading or Wishlist
- Rate a book on prose, plot, characters and re-read, with an overall score and a review
- Rate a book you do not own — a loan or a search result keeps its score either way
- Track where you are in a book by page, and mark it finished from the book page
- Filter and group the Library by author, genre, format, year, publisher and shop
- See reading stats: pages and books finished, rating curve, decades, most-read authors
- Follow friends' reading in the Social feed, with reactions and comments
- Share one account, friend list and privacy switch with Radar and Sonar
- Sign-in screen leads with the Lidar mark, a lidar scope sweeping an open book
