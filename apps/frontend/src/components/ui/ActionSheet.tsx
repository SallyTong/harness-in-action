import { X } from "lucide-react";

interface ActionSheetOption {
  label: string;
  icon: string;
  onClick: () => void;
}

interface ActionSheetProps {
  open: boolean;
  options: ActionSheetOption[];
  onClose: () => void;
}

export default function ActionSheet({
  open,
  options,
  onClose,
}: ActionSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="rounded-t-[16px] bg-white pb-8 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-[15px] font-medium text-[#6B6560]">
            选择上传方式
          </span>
          <button
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#A39D97] transition-colors hover:bg-[#F3F0ED]"
            aria-label="关闭"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="mt-3 px-4">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                opt.onClick();
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-[10px] px-4 py-3.5 text-left text-[15px] font-medium text-[#1E1B18] transition-colors hover:bg-[#F3F0ED]"
            >
              <span className="text-xl">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
