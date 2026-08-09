import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiGet, apiPatch } from "../lib/api";
import Skeleton from "../components/ui/Skeleton";
import ImageLightbox from "../components/ui/ImageLightbox";
import Toast, { type ToastType } from "../components/ui/Toast";
import type {
  Submission,
  GradedQuestion,
  ScoreSummary,
  FixQuestionResponse,
} from "../types";

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} 天前`;
  return date.toLocaleDateString("zh-CN");
}

const TYPE_LABELS: Record<string, string> = {
  choice: "选择题",
  fill_blank: "填空题",
  reading: "阅读理解",
  composition: "作文",
  calculation: "计算题",
  word_problem: "应用题",
};

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [savingQid, setSavingQid] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    apiGet<Submission>(`/api/submissions/${id}`)
      .then((data) => {
        setSubmission(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      });
  }, [id]);

  const toggleNote = (qid: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  };

  const handleToggleCorrect = async (q: GradedQuestion) => {
    if (!submission || savingQid !== null) return;
    const newValue = !q.is_correct;

    // Optimistic update
    setSavingQid(q.id);
    const oldQuestions = submission.questions;
    const oldScore = submission.score;

    const updatedQuestions = (submission.questions || []).map((item) =>
      item.id === q.id
        ? { ...item, is_correct: newValue, is_manually_fixed: true }
        : item,
    );
    const newCorrect = updatedQuestions.filter((item) => item.is_correct).length;
    const newScore: ScoreSummary = {
      correct: newCorrect,
      total: submission.total_questions || updatedQuestions.length,
    };

    setSubmission({
      ...submission,
      questions: updatedQuestions,
      score: newScore,
      correct_count: newCorrect,
    });

    try {
      await apiPatch<FixQuestionResponse>(
        `/api/submissions/${submission.id}/questions/${q.id}`,
        { is_correct: newValue },
      );
      setToast({
        message: newValue ? "已标记为正确" : "已标记为错误",
        type: "success",
      });
    } catch (err) {
      // Revert
      setSubmission({
        ...submission,
        questions: oldQuestions,
        score: oldScore,
        correct_count: oldScore?.correct ?? null,
      });
      setToast({
        message:
          err instanceof Error ? err.message : "保存失败，请重试",
        type: "error",
      });
    } finally {
      setSavingQid(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-16">
        <header className="flex items-center gap-3 py-4">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-24 rounded" />
        </header>
        {/* Score card skeleton */}
        <Skeleton className="mb-4 h-24 w-full rounded-[14px]" />
        {/* Image skeleton */}
        <Skeleton className="mb-6 h-48 w-full rounded-[14px]" />
        {/* Question rows */}
        <Skeleton className="mb-2 h-16 w-full rounded-[10px]" />
        <Skeleton className="mb-2 h-16 w-full rounded-[10px]" />
        <Skeleton className="mb-2 h-16 w-full rounded-[10px]" />
      </div>
    );
  }

  // Error state
  if (error || !submission) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 pb-16">
        <span className="text-5xl">😞</span>
        <p className="mt-4 text-[15px] text-error">{error || "加载失败"}</p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 min-h-11 rounded-xl bg-accent px-6 py-2 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover"
        >
          返回首页
        </button>
      </div>
    );
  }

  const score = submission.score;
  const questions = submission.questions || [];
  const isGoodScore = score ? score.correct / score.total >= 0.6 : true;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-16">
      {/* Top bar */}
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={() => navigate("/")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-tertiary transition-colors hover:bg-brand-hover"
          aria-label="返回首页"
        >
          <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
        <h1 className="text-[18px] font-semibold text-text-primary">
          批改结果
        </h1>
        {submission.subject && (
          <span className="ml-auto rounded-full bg-accent-subtle px-3 py-1 text-[11px] font-medium text-accent">
            {submission.subject === "english" ? "英语" : "数学"}
          </span>
        )}
      </header>

      {/* Score overview card */}
      {score && (
        <div className="mb-4 rounded-[14px] border border-border-light bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-text-tertiary">得分</p>
              <p
                className={`mt-1 font-mono text-[28px] font-semibold leading-[36px] ${
                  isGoodScore ? "text-success" : "text-error"
                }`}
              >
                {isGoodScore ? "✅" : "❌"} {score.correct}/{score.total}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-text-tertiary">
                {submission.child_name}
              </p>
              <p className="mt-1 text-[13px] text-text-secondary">
                {formatRelativeTime(submission.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Annotated image */}
      {submission.annotated_image_url && (
        <div className="mb-6">
          <button
            onClick={() => setLightboxOpen(true)}
            className="w-full overflow-hidden rounded-[14px] shadow-sm transition-opacity hover:opacity-90"
          >
            <img
              src={submission.annotated_image_url}
              alt="批改后试卷"
              className="w-full object-contain"
            />
          </button>
          <p className="mt-1 text-center text-[11px] text-text-tertiary">
            点击图片可放大查看
          </p>
        </div>
      )}

      {/* Question detail list */}
      {questions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[15px] font-medium text-text-secondary">
            逐题明细
          </h3>
          {questions.map((q) => (
            <div
              key={q.id}
              className={`rounded-[10px] border bg-white p-3 shadow-sm ${
                q.is_correct
                  ? "border-l-2 border-l-[#22C55E] border-border-light"
                  : "border-l-2 border-l-[#EF4444] border-border-light"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-text-primary">
                    第 {q.question_number} 题
                  </span>
                  <span className="rounded-full bg-brand-hover px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    {TYPE_LABELS[q.question_type] || q.question_type}
                  </span>
                  {q.is_manually_fixed && (
                    <span className="rounded-full bg-[#FEF9C3] px-2 py-0.5 text-[10px] font-medium text-[#A16207]">
                      已修正
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Manual correction toggle */}
                  <button
                    onClick={() => handleToggleCorrect(q)}
                    disabled={savingQid === q.id}
                    className={`flex min-h-8 min-w-8 items-center justify-center rounded-xl text-[11px] font-medium transition-colors ${
                      q.is_correct
                        ? "bg-[#DCFCE7] text-[#16A34A] hover:bg-[#BBF7D0]"
                        : "bg-error-bg text-error hover:bg-[#FEE2E2]"
                    } ${savingQid === q.id ? "opacity-50" : ""}`}
                    aria-label={q.is_correct ? "标记为错" : "标记为对"}
                  >
                    {savingQid === q.id ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : q.is_correct ? (
                      <CheckCircle size={14} strokeWidth={1.5} />
                    ) : (
                      <HelpCircle size={14} strokeWidth={1.5} />
                    )}
                  </button>
                  {q.solution_note && (
                    <button
                      onClick={() => toggleNote(q.id)}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-tertiary transition-colors hover:bg-brand-hover"
                      aria-label={
                        expandedNotes.has(q.id) ? "收起" : "展开"
                      }
                    >
                      {expandedNotes.has(q.id) ? (
                        <ChevronUp size={16} strokeWidth={1.5} />
                      ) : (
                        <ChevronDown size={16} strokeWidth={1.5} />
                      )}
                    </button>
                  )}
                </div>
              </div>
              {/* Solution note (expandable) */}
              {q.solution_note && expandedNotes.has(q.id) && (
                <div className="mt-2 rounded-[8px] bg-error-bg px-3 py-2">
                  <p className="text-[13px] leading-relaxed text-text-primary">
                    {q.solution_note}
                  </p>
                  {q.error_category && (
                    <span className="mt-1 inline-block rounded-full bg-error-bg px-2 py-0.5 text-[11px] font-medium text-error">
                      {
                        {
                          grammar: "语法",
                          vocabulary: "词汇",
                          spelling: "拼写",
                          logic: "逻辑",
                          calculation: "计算",
                          careless: "粗心",
                          comprehension: "理解",
                        }[q.error_category] || q.error_category
                      }
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom action */}
      <div className="mt-8">
        <button
          onClick={() => navigate("/")}
          className="w-full rounded-xl bg-accent py-3 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          返回首页
        </button>
      </div>

      {/* Lightbox */}
      {submission.annotated_image_url && (
        <ImageLightbox
          src={submission.annotated_image_url}
          alt="批改后试卷"
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
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
