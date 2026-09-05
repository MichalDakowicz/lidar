import { create } from 'zustand';

type QuickAddSheetState = {
  present: ((isbn?: string | null) => void) | null;
  setPresent: (present: ((isbn?: string | null) => void) | null) => void;
};

// The QuickAddSheet mounts once in the (tabs) layout - Add is reachable from
// every screen via the nav bar's left island - and this store lets any screen
// trigger it without re-mounting the sheet per tab.
//
// `present` optionally carries an ISBN, which is how a scan that no catalogue
// could answer reaches the add-by-hand form: the number identifies the edition
// even when nothing knows its title, and lib/bookKey keys on it, so a book
// added by hand here lines up with a rating made later from a catalogue hit for
// the same edition. Without it the row would key `manual:<author>|<title>` and
// strand its own rating.
export const useQuickAddSheetStore = create<QuickAddSheetState>((set) => ({
  present: null,
  setPresent: (present) => set({ present }),
}));
