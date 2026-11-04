import { useRef } from 'react';
import { Modal } from './Modal';
import { cn } from '../../utils/cn';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', destructive, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal open={open} title={title} description={description} onClose={onCancel} initialFocusRef={cancelRef} role="alertdialog">
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={onConfirm} className={cn(destructive ? 'btn-danger' : 'btn-primary')}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
