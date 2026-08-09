import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Wand2,
  RotateCcw,
} from "lucide-react";
import { apiGet } from "../lib/api";
import Skeleton from "../components/ui/Skeleton";
import Toast, { type ToastType } from "../components/ui/Toast";
import type {
  Child,
  ErrorQuestionItem,
  ErrorCollectionListResponse,
} from "../types";

const TYPE_LABELS: Record<string, string> = {
  choice: "选择题",
  fill_blank: "填空题",
  reading: "阅读理解",
  composition: "作文",
  calculation: "计算题",
  word_problem: "应用题",
};

const ERROR_LABELS: Record<string, string> = {
  grammar: "语法",
  vocabulary: "词汇",
  spelling: "拼写",
  logic: "逻辑",
  calculation: "计算",
  careless: "粗心",
  comprehension: "理解",
};

const TIME_RANGES = [
  { label: "全部", value: "" },
  { label: "最近一周", value: "7d" },
  { label: "最近一月", value: "30d" },
];

const SUBJECT_LABELS: Record<string, string> = {
  english: "英语",
  math: "数学",
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ErrorBookPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [children, setChildren] = useState<Child[]>([]);
  const [errors, setErrors] = useState<ErrorQuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Filter state from URL params
  const [childId, setChildId] = useState<string>(
    searchParams.get("child_id") || "",
  );
  const [subject, setSubject] = useState<string>(
    searchParams.get("subject") || "",
  );
  const [questionType, setQuestionType] = useState<string>(
    searchParams.get("question_type") || "",
  );
  const [timeRange, setTimeRange] = useState<string>(
    searchParams.get("time_range") || "",
  );
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;

  // Load children
  useEffect(() => {
    apiGet<Child[]>("/api/children")
      .then(setChildren)
      .catch(() => {});
  }, []);

  // Fetch errors
  const fetchErrors = useCallback(
    async (resetOffset: boolean) => {
      const newOffset = resetOffset ? 0 : offset;
      if (resetOffset) setOffset(0);

      setLoading(true);
      setFetchError(null);

      const params = new URLSearchParams();
      if (childId) params.set("child_id", childId);
      if (subject) params.set("subject", subject);
      if (questionType) params.set("question_type", questionType);

      // Convert time range to dates
      if (timeRange === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.set("from_date", d.toISOString().split("T")[0]);
      } else if (timeRange === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.set("from_date", d.toISOString().split("T")[0]);
      }

      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(newOffset));

      const qs = params.toString();
      const path = `/api/error-collections${qs ? `?${qs}` : ""}`;

      try {
        const data = await apiGet<ErrorCollectionListResponse>(path);
        if (resetOffset) {
          setErrors(data.items);
        } else {
          setErrors((prev) => [...prev, ...data.items]);
        }
        setTotal(data.total);
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : "加载失败",
        );
      } finally {
        setLoading(false);
      }
    },
    [childId, subject, questionType, timeRange, offset],
  );

  useEffect(() => {
    fetchErrors(true);
  }, [childId, subject, questionType, timeRange]);

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    // Trigger re-fetch via effect
    fetchErrors(false);
  };

  const toggleNote = (id: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setChildId("");
    setSubject("");
    setQuestionType("");
    setTimeRange("");
  };

  const hasFilters = childId || subject || questionType || timeRange;
  const hasMore = errors.length < total;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-24">
      {/* Top bar */}
      <header className="flex items-center justify-between py-4">
        <h1 className="text-[22px] font-semibold leading-[30px] text-[#1E1B18]">
          错题集
        </h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors ${
            showFilters || hasFilters
              ? "bg-[#EEF2FF] text-[#6366F1]"
              : "text-[#A39D97] hover:bg-[#F3F0ED]"
          }`}
          aria-label="筛选"
        >
          <Filter size={20} strokeWidth={1.5} />
        </button>
      </header>

      {/* Filter bar */}
      {showFilters && (
        <div className="mb-4 space-y-3 rounded-[14px] border border-[#F0EDE8] bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              className="flex-1 rounded-[10px] border border-[#E5E0DA] bg-white px-3 py-2.5 text-[14px] text-[#1E1B18] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
            >
              <option value="">全部小朋友</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 rounded-[10px] border border-[#E5E0DA] bg-white px-3 py-2.5 text-[14px] text-[#1E1B18] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
            >
              <option value="">全部学科</option>
              <option value="english">英语</option>
              <option value="math">数学</option>
            </select>
          </div>
          <div className="flex gap-2">
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="flex-1 rounded-[10px] border border-[#E5E0DA] bg-white px-3 py-2.5 text-[14px] text-[#1E1B18] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
            >
              <option value="">全部题型</option>
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="flex-1 rounded-[10px] border border-[#E5E0DA] bg-white px-3 py-2.5 text-[14px] text-[#1E1B18] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
            >
              {TIME_RANGES.map((tr) => (
                <option key={tr.value} value={tr.value}>
                  {tr.label}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-[13px] text-[#6366F1] transition-colors hover:text-[#4F46E5]"
            >
              <RotateCcw size={14} strokeWidth={1.5} />
              清除筛选
            </button>
          )}
        </div>
      )}

      {/* Stats summary */}
      {!loading && (
        <p className="mb-4 text-[13px] font-medium text-[#6B6560]">
          共 {total} 道错题
        </p>
      )}

      {/* Error list */}
      {loading && errors.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-[14px]" />
          <Skeleton className="h-40 w-full rounded-[14px]" />
          <Skeleton className="h-40 w-full rounded-[14px]" />
        </div>
      ) : fetchError ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16">
          <span className="text-4xl">⚠️</span>
          <p className="mt-3 text-[15px] text-[#EF4444]">{fetchError}</p>
          <button
            onClick={() => fetchErrors(true)}
            className="mt-4 min-h-11 rounded-xl bg-[#6366F1] px-6 py-2 text-[15px] font-medium text-white transition-colors hover:bg-[#4F46E5]"
          >
            重试
          </button>
        </div>
      ) : errors.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16">
          <span className="text-5xl">
            {hasFilters ? "🔍" : "🎉"}
          </span>
          <p className="mt-4 text-[15px] font-medium text-[#6B6560]">
            {hasFilters
              ? "没有符合条件的错题"
              : "还没有错题。继续保持！"}
          </p>
          <p className="mt-1 text-[13px] text-[#A39D97]">
            {hasFilters
              ? "试试调整筛选条件"
              : "去批改试卷，错题会自动收集到这里"}
          </p>
          {hasFilters ? (
            <button
              onClick={clearFilters}
              className="mt-6 min-h-11 rounded-xl border border-[#E5E0DA] bg-white px-6 py-2 text-[15px] font-medium text-[#6B6560] transition-colors hover:bg-[#F3F0ED]"
            >
              清除筛选
            </button>
          ) : (
            <button
              onClick={() => navigate("/")}
              className="mt-6 min-h-11 rounded-xl bg-[#6366F1] px-6 py-2 text-[15px] font-medium text-white transition-colors hover:bg-[#4F46E5]"
            >
              去批改
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {errors.map((eq) => (
            <div
              key={eq.id}
              className="overflow-hidden rounded-[14px] border border-[#F0EDE8] bg-white shadow-sm"
            >
              {/* Question image */}
              {eq.question_image_path && (
                <img
                  src={eq.question_image_path}
                  alt={`第${eq.question_number}题`}
                  className="w-full object-contain"
                  loading="lazy"
                />
              )}
              {/* Info bar */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#1E1B18]">
                    第 {eq.question_number} 题
                  </span>
                  <span className="rounded-full bg-[#F3F0ED] px-2 py-0.5 text-[11px] font-medium text-[#6B6560]">
                    {TYPE_LABELS[eq.question_type] || eq.question_type}
                  </span>
                  <span className="text-[12px] text-[#A39D97]">
                    {eq.child_name} ·{" "}
                    {SUBJECT_LABELS[eq.subject] || eq.subject}
                  </span>
                </div>
                <span className="text-[11px] text-[#A39D97]">
                  {formatDate(eq.last_error_at)}
                </span>
              </div>
              {/* Solution note */}
              {eq.solution_note && (
                <div className="border-t border-[#F0EDE8] px-4 py-2">
                  <button
                    onClick={() => toggleNote(eq.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-[12px] font-medium text-[#6B6560]">
                      💡 解题思路
                    </span>
                    {expandedNotes.has(eq.id) ? (
                      <ChevronUp
                        size={14}
                        strokeWidth={1.5}
                        className="text-[#A39D97]"
                      />
                    ) : (
                      <ChevronDown
                        size={14}
                        strokeWidth={1.5}
                        className="text-[#A39D97]"
                      />
                    )}
                  </button>
                  {expandedNotes.has(eq.id) && (
                    <div className="mt-2 rounded-[8px] bg-[#FEF2F2] px-3 py-2">
                      <p className="text-[13px] leading-relaxed text-[#1E1B18]">
                        {eq.solution_note}
                      </p>
                      {eq.error_category && (
                        <span className="mt-1 inline-block rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-medium text-[#EF4444]">
                          {ERROR_LABELS[eq.error_category] ||
                            eq.error_category}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="w-full rounded-xl border border-[#E5E0DA] bg-white py-3 text-[14px] font-medium text-[#6B6560] transition-colors hover:bg-[#F3F0ED] disabled:opacity-50"
            >
              {loading ? "加载中…" : "加载更多"}
            </button>
          )}

          {!hasMore && errors.length > 0 && (
            <p className="py-4 text-center text-[12px] text-[#A39D97]">
              —— 已显示全部错题 ——
            </p>
          )}
        </div>
      )}

      {/* Bottom fixed bar: generate sheet button */}
      {errors.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto max-w-lg">
            <button
              onClick={() => {
                const params = new URLSearchParams();
                if (childId) params.set("child_id", childId);
                if (subject) params.set("subject", subject);
                if (questionType)
                  params.set("question_type", questionType);
                navigate(`/errors/generate?${params.toString()}`);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366F1] py-3 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-[#4F46E5]"
            >
              <Wand2 size={18} strokeWidth={1.5} />
              生成错题试卷
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
