import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { NavIslands } from '@/components/layout/NavIslands';
import type { BottomSheetModal } from '@/components/ui/Sheet';
import { IsbnScannerSheet } from '@/features/books/add/IsbnScannerSheet';
import { QuickAddSheet } from '@/features/books/add/QuickAddSheet';
import { DEFAULT_DRAFT, type QuickAddDraft } from '@/features/books/add/useQuickAdd';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBrowsePreload } from '@/features/browse/useBrowsePreload';
import { FriendRequestListener } from '@/features/friends/FriendRequestListener';
import { StatsPeriodSheet } from '@/features/stats/StatsPeriodSheet';
import { useIsbnScannerStore } from '@/store/isbnScanner';
import { useQuickAddSheetStore } from '@/store/quickAddSheet';
import { useStatsPeriodSheet } from '@/store/statsPeriod';

/**
 * Bottom tab shell. The bar is the floating nav islands on every viewport,
 * phone and desktop web alike — it is the app's only navigation chrome, and it
 * drives itself off the route rather than off this navigator so it can also
 * render on /settings, /inbox and /history.
 *
 * Keep the screen order below in sync with NAV_DESTINATIONS: the web digit
 * shortcuts index into that list.
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const quickAddRef = useRef<BottomSheetModal>(null);
  const scannerRef = useRef<BottomSheetModal>(null);
  const periodRef = useRef<BottomSheetModal>(null);
  const [scanDraft, setScanDraft] = useState<QuickAddDraft>(DEFAULT_DRAFT);
  const setPresentQuickAdd = useQuickAddSheetStore((s) => s.setPresent);
  const setPresentScanner = useIsbnScannerStore((s) => s.setPresent);
  const setPresentPeriod = useStatsPeriodSheet((s) => s.setPresent);

  // Warms Browse's rows in the background after login, so the tab opens on
  // content rather than on spinners. Mounted here because it must not wait for
  // the user to reach that tab.
  useBrowsePreload();

  // All three sheets mount once here rather than per screen, so anything on any
  // route can open the same instance: Add from the nav's left action on the
  // library, the period picker from that action on Stats and from the pill.
  // The scanner especially — one live CameraView in the tree, never several.
  useEffect(() => {
    setPresentQuickAdd(() => quickAddRef.current?.present());
    return () => setPresentQuickAdd(null);
  }, [setPresentQuickAdd]);

  useEffect(() => {
    setPresentScanner((draft?: QuickAddDraft) => {
      if (draft) setScanDraft(draft);
      scannerRef.current?.present();
    });
    return () => setPresentScanner(null);
  }, [setPresentScanner]);

  useEffect(() => {
    setPresentPeriod(() => periodRef.current?.present());
    return () => setPresentPeriod(null);
  }, [setPresentPeriod]);

  if (!user) return <Redirect href="/login" />;

  return (
    <>
      <Tabs
        tabBar={() => <NavIslands />}
        // No scene animation: react-navigation cross-fades over the navigator's
        // own background, which flashes white on every swap. The movement that
        // makes a tab change feel smooth lives in the nav bar instead, where the
        // marker slides between destinations. sceneStyle pins the app background
        // so nothing can show through between screens.
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'hsl(0 0% 3.9%)' } }}
      >
        <Tabs.Screen name="index" options={{ title: 'Library' }} />
        <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
        <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
        <Tabs.Screen name="social" options={{ title: 'Social' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      <QuickAddSheet ref={quickAddRef} />
      <IsbnScannerSheet
        ref={scannerRef}
        draft={scanDraft}
        onAdded={(book) => {
          scannerRef.current?.dismiss();
          router.push({ pathname: '/book/[bookId]', params: { bookId: book.id } });
        }}
      />
      <StatsPeriodSheet ref={periodRef} onPicked={() => periodRef.current?.dismiss()} />
      <FriendRequestListener />
    </>
  );
}
