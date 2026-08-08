import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

const typeStyles: Record<ToastType, string> = {
  success: "bg-[#F0FDF4] text-[#22C55E]",
  error: "bg-[#FEF2F2] text-[#EF4444]",
  info: "bg-[#EEF2FF] text-[#6366F1]",
};

export default function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-[10px] px-4 py-3 text-sm font-medium shadow-md ${typeStyles[type]}`}
    >
      {message}
    </div>
  );
}
