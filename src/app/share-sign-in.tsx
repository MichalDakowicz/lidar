import { HandoffStatus } from '@/features/auth/HandoffStatus';
import { useShareSignIn } from '@/features/auth/useShareSignIn';

/** `lidar://share-sign-in` — a sibling on this phone asked Lidar for a sign-in (PING.md §9.13). */
export default function ShareSignIn() {
  const request = useShareSignIn();
  return <HandoffStatus message={request ? `Signing ${request.requester.name} in…` : 'Opening Lidar…'} />;
}
