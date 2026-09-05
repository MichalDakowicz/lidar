import { create } from 'zustand';

import type { QuickAddDraft } from '@/features/books/add/useQuickAdd';

type IsbnScannerState = {
  /** Opens the scanner, carrying the caller's status draft into it. */
  present: ((draft?: QuickAddDraft) => void) | null;
  setPresent: (present: ((draft?: QuickAddDraft) => void) | null) => void;
};

/**
 * The scanner sheet mounts once in the (tabs) layout, the same way the Quick-Add
 * sheet does, so any screen can open the one instance rather than each screen
 * mounting a camera of its own — several live `CameraView`s in a tree is a fast
 * way to get a black preview and a held-open camera on Android.
 *
 * The draft rides along in the call rather than being read from a store,
 * because it belongs to whoever opened the scanner: adding from the Quick-Add
 * sheet should honour the status picked there.
 */
export const useIsbnScannerStore = create<IsbnScannerState>((set) => ({
  present: null,
  setPresent: (present) => set({ present }),
}));
