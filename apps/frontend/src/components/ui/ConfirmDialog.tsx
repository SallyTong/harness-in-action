interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 w-full max-w-sm rounded-[14px] bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-[#1E1B18]">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6560]">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="min-h-11 rounded-xl px-4 py-2 text-[15px] font-medium text-[#6B6560] transition-colors hover:bg-[#F3F0ED]"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-[#EF4444] px-4 py-2 text-[15px] font-medium text-white transition-colors hover:bg-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
