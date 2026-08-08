import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet } from "../lib/api";
import type { Submission } from "../types";

const POLL_INTERVAL = 2000;
const TIMEOUT_MS = 30000;

const CAROUSEL_TEXTS = [
  { text: "识别题目中…", icon: "🔍" },
  { text: "批改答案中…", icon: "✏️" },
  { text: "生成解题思路中…", icon: "📝" },
];

export default function ProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Carousel rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % CAROUSEL_TEXTS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Polling
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (cancelled) return;

      try {
        const data = await apiGet<Submission>(
          `/api/submissions/${id}`,
        );

        if (cancelled) return;

        if (data.status === "completed") {
          navigate(`/submissions/${id}/result`, { replace: true });
          return;
        }

        if (data.status === "failed") {
          setError("批改失败，请重试。");
          if (pollTimer) clearInterval(pollTimer);
          return;
        }

        // Check timeout
        if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
          setTimedOut(true);
          if (pollTimer) clearInterval(pollTimer);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "查询批改状态失败",
          );
          if (pollTimer) clearInterval(pollTimer);
        }
      }
    };

    // Initial poll
    poll();
    // Start interval
    pollTimer = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [id, navigate]);

  const { text, icon } = CAROUSEL_TEXTS[carouselIndex];

  // Error state
  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 pb-16">
        <div className="text-center">
          <span className="text-5xl">😞</span>
          <p className="mt-4 text-[15px] text-[#EF4444]">{error}</p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => navigate("/")}
              className="min-h-11 rounded-xl border border-[#E5E0DA] px-6 py-2 text-[15px] font-medium text-[#6B6560] transition-colors hover:bg-[#F3F0ED]"
            >
              返回首页
            </button>
            <button
              onClick={() => {
                setError(null);
                setTimedOut(false);
                startTimeRef.current = Date.now();
              }}
              className="min-h-11 rounded-xl bg-[#6366F1] px-6 py-2 text-[15px] font-medium text-white transition-colors hover:bg-[#4F46E5]"
            >
              重新批改
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Timeout state
  if (timedOut) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 pb-16">
        <div className="text-center">
          <span className="text-5xl">⏳</span>
          <p className="mt-4 text-[15px] font-medium text-[#F59E0B]">
            批改时间较长，请稍候或重试
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => navigate("/")}
              className="min-h-11 rounded-xl border border-[#E5E0DA] px-6 py-2 text-[15px] font-medium text-[#6B6560] transition-colors hover:bg-[#F3F0ED]"
            >
              返回首页
            </button>
            <button
              onClick={() => {
                setError(null);
                setTimedOut(false);
                startTimeRef.current = Date.now();
              }}
              className="min-h-11 rounded-xl bg-[#6366F1] px-6 py-2 text-[15px] font-medium text-white transition-colors hover:bg-[#4F46E5]"
            >
              继续等待
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal processing state
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 pb-16">
      {/* Animated pencil */}
      <div className="mb-8 animate-bounce text-6xl">✏️</div>

      {/* Carousel text */}
      <span className="text-[22px] font-semibold text-[#1E1B18]">
        {icon} {text}
      </span>

      {/* Indeterminate progress bar */}
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-[#F0EDE8]">
        <div className="h-full w-1/2 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-[#6366F1]" />
      </div>

      {/* Estimate */}
      <p className="mt-4 text-[13px] text-[#A39D97]">
        通常需要 5-15 秒
      </p>

      {/* Cancel button */}
      <button
        onClick={() => navigate("/")}
        className="mt-8 min-h-11 rounded-xl border border-[#E5E0DA] px-6 py-2 text-[15px] font-medium text-[#6B6560] transition-colors hover:bg-[#F3F0ED]"
      >
        取消
      </button>
    </div>
  );
}
