import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

const typeStyles: Record<ToastType, string> = {
  success: "bg-success-bg text-success",
  error: "bg-error-bg text-error",
  info: "bg-accent-subtle text-accent",
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
