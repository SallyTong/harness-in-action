import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiPostPublic } from "../lib/api";
import { isAuthenticated, setToken } from "../lib/auth";
import Toast, { type ToastType } from "../components/ui/Toast";

const RESEND_SECONDS = 60;

export default function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  // 60s resend countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const phoneValid = /^\d{11}$/.test(phone);
  const codeValid = /^\d{6}$/.test(code);

  const handleSendCode = async () => {
    if (!phoneValid) {
      setToast({ message: "请输入 11 位手机号", type: "error" });
      return;
    }
    setSending(true);
    try {
      await apiPostPublic("/api/auth/send-code", { phone });
      setCountdown(RESEND_SECONDS);
      setToast({ message: "验证码已发送", type: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "发送失败，请重试",
        type: "error",
      });
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async () => {
    if (!phoneValid) {
      setToast({ message: "请输入 11 位手机号", type: "error" });
      return;
    }
    if (!codeValid) {
      setToast({ message: "请输入 6 位验证码", type: "error" });
      return;
    }
    setLoggingIn(true);
    try {
      const data = await apiPostPublic<{ token: string }>("/api/auth/login", {
        phone,
        code,
      });
      setToken(data.token);
      navigate("/", { replace: true });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "登录失败，请重试",
        type: "error",
      });
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-brand-page px-6 py-10">
      {/* Header */}
      <div className="mt-10">
        <h1 className="text-[22px] font-semibold leading-[30px] text-text-primary">欢迎使用</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-text-secondary">
          手机号验证码登录，跨设备同步批改记录
        </p>
      </div>

      {/* Form */}
      <form
        className="mt-10 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <div>
          <label className="mb-2 block text-[13px] font-medium text-text-secondary">手机号</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="请输入 11 位手机号"
            maxLength={11}
            inputMode="numeric"
            autoComplete="tel"
            className="w-full rounded-[10px] border border-border bg-white px-4 py-3 text-[15px] text-text-primary placeholder-[#A39D97] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-medium text-text-secondary">验证码</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6 位验证码"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="flex-1 rounded-[10px] border border-border bg-white px-4 py-3 text-[15px] text-text-primary placeholder-[#A39D97] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={countdown > 0 || sending || !phoneValid}
              className="min-h-11 shrink-0 rounded-xl border border-border px-4 text-[13px] font-medium text-accent transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:text-text-tertiary"
            >
              {countdown > 0 ? `${countdown}s 后重发` : sending ? "发送中…" : "获取验证码"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!phoneValid || !codeValid || loggingIn}
          className="flex w-full min-h-11 items-center justify-center rounded-xl bg-accent py-3 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingIn ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "登录"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[11px] text-text-tertiary">
        登录即代表同意数据仅用于作业批改
      </p>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
