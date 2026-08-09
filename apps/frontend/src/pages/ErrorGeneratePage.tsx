import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Wand2, Download } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import Toast, { type ToastType } from "../components/ui/Toast";
import type { Child, GenerateSheetResponse } from "../types";

const TYPE_LABELS: Record<string, string> = {
  choice: "选择题",
  fill_blank: "填空题",
  reading: "阅读理解",
  composition: "作文",
  calculation: "计算题",
  word_problem: "应用题",
};

const ALL_TYPES = Object.keys(TYPE_LABELS);

// Filter types by subject
const SUBJECT_TYPES: Record<string, string[]> = {
  english: ["choice", "fill_blank", "reading", "composition"],
  math: ["choice", "fill_blank", "calculation", "word_problem"],
};

export default function ErrorGeneratePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string>(
    searchParams.get("child_id") || "",
  );
  const [subject, setSubject] = useState<string>(
    searchParams.get("subject") || "english",
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(searchParams.getAll("question_type")),
  );
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateSheetResponse | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  useEffect(() => {
    apiGet<Child[]>("/api/children")
      .then(setChildren)
      .catch(() => {});
  }, []);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const availableTypes =
    SUBJECT_TYPES[subject] || ALL_TYPES;

  const handleGenerate = async () => {
    if (!childId) {
      setToast({ message: "请选择小朋友", type: "error" });
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        child_id: Number(childId),
        subject,
        count,
      };

      if (selectedTypes.size > 0) {
        body.question_types = Array.from(selectedTypes);
      }

      const data = await apiPost<GenerateSheetResponse>(
        "/api/error-collections/generate",
        body,
      );
      setResult(data);
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "生成失败，请重试",
        type: "error",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveImage = () => {
    if (!result?.image_url) return;
    const a = document.createElement("a");
    a.href = result.image_url;
    a.download = `错题试卷_${new Date().toISOString().split("T")[0]}.jpg`;
    a.click();
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-16">
      {/* Top bar */}
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#A39D97] transition-colors hover:bg-[#F3F0ED]"
          aria-label="返回"
        >
          <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
        <h1 className="text-[18px] font-semibold text-[#1E1B18]">
          生成错题试卷
        </h1>
      </header>

      {/* Parameter form */}
      <div className="space-y-5 rounded-[14px] border border-[#F0EDE8] bg-white p-5 shadow-sm">
        {/* Child */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#6B6560]">
            小朋友
          </label>
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            className="w-full rounded-[10px] border border-[#E5E0DA] bg-white px-3 py-2.5 text-[15px] text-[#1E1B18] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
          >
            <option value="">请选择小朋友</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#6B6560]">
            学科
          </label>
          <div className="flex rounded-[10px] border border-[#E5E0DA] bg-white p-0.5">
            <button
              onClick={() => {
                setSubject("english");
                setSelectedTypes(new Set());
              }}
              className={`flex-1 rounded-[8px] py-2.5 text-[15px] font-medium transition-colors ${
                subject === "english"
                  ? "bg-[#6366F1] text-white"
                  : "text-[#6B6560]"
              }`}
            >
              英语
            </button>
            <button
              onClick={() => {
                setSubject("math");
                setSelectedTypes(new Set());
              }}
              className={`flex-1 rounded-[8px] py-2.5 text-[15px] font-medium transition-colors ${
                subject === "math"
                  ? "bg-[#6366F1] text-white"
                  : "text-[#6B6560]"
              }`}
            >
              数学
            </button>
          </div>
        </div>

        {/* Question types */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#6B6560]">
            题型（可多选，留空表示全部）
          </label>
          <div className="flex flex-wrap gap-2">
            {availableTypes.map((t) => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  selectedTypes.has(t)
                    ? "bg-[#EEF2FF] text-[#6366F1]"
                    : "bg-[#F3F0ED] text-[#6B6560] hover:bg-[#E5E0DA]"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Count slider */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-[#6B6560]">
            <span>题目数量</span>
            <span className="font-mono text-[15px] text-[#1E1B18]">
              {count} 题
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#F3F0ED] accent-[#6366F1]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-[#A39D97]">
            <span>1</span>
            <span>50</span>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating || !childId}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-medium text-white shadow-sm transition-all ${
          generating || !childId
            ? "cursor-not-allowed bg-[#6366F1] opacity-50"
            : "bg-[#6366F1] hover:bg-[#4F46E5]"
        }`}
      >
        {generating ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            正在生成…
          </>
        ) : (
          <>
            <Wand2 size={18} strokeWidth={1.5} />
            生成试卷
          </>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[15px] font-medium text-[#6B6560]">
              已生成 {result.question_count} 道错题试卷
            </p>
            <button
              onClick={handleSaveImage}
              className="flex min-h-11 items-center gap-1 rounded-xl bg-[#22C55E] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-green-600"
            >
              <Download size={16} strokeWidth={1.5} />
              保存图片
            </button>
          </div>
          <div className="overflow-hidden rounded-[14px] shadow-sm">
            <img
              src={result.image_url}
              alt="错题试卷"
              className="w-full object-contain"
            />
          </div>
          <button
            onClick={() => {
              setResult(null);
              handleGenerate();
            }}
            className="mt-4 w-full rounded-xl border border-[#E5E0DA] bg-white py-3 text-[14px] font-medium text-[#6B6560] transition-colors hover:bg-[#F3F0ED]"
          >
            重新生成
          </button>
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
