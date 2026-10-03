import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type LowerPageConfirmProps = {
  visible: boolean;
  /** The save empties the field, rather than typing a lower page. */
  clearing: boolean;
  /** The page on the "Last saved" side, as the reader types it. */
  saved: number | null;
  /** The page in the field, as the reader typed it. */
  typed: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The question in front of a save that would take the bookmark backwards.
 *
 * Both halves of the answer matter, so both are said: it is the one save that
 * can undo days of tracking with a slipped digit, and it costs nothing already
 * counted — the ledger keeps every page it has recorded, which is why this is a
 * question and not a wall. Someone starting the book again wants to say yes.
 */
export function LowerPageConfirm({ visible, clearing, saved, typed, onConfirm, onCancel }: LowerPageConfirmProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title={clearing ? 'Clear the bookmark?' : 'Move the bookmark back?'}
      description={
        clearing
          ? `The page field is empty, so saving removes your place on page ${saved}. Pages you already read stay counted.`
          : `You are on page ${saved}. Saving page ${typed.trim()} puts you behind it. Pages you already read stay counted.`
      }
      confirmLabel={clearing ? 'Clear bookmark' : 'Move back'}
      destructive
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
