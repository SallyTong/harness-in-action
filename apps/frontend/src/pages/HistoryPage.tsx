import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { usePhone } from "../hooks/usePhone";
import { apiGet } from "../lib/api";
import Skeleton from "../components/ui/Skeleton";
import type { Child, SubmissionListResponse, SubmissionSummary } from "../types";

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

const LIMIT = 20;

export default function HistoryPage() {
  const { phone, setPhone, isReady } = usePhone();
  const navigate = useNavigate();

  // Filter state
  const [children, setChildren] = useState<Child[]>([]);
  const [childFilter, setChildFilter] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("");

  // Data state
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Fetch children for filter dropdown
  useEffect(() => {
    if (!isReady) return;
    apiGet<Child[]>("/api/children")
      .then(setChildren)
      .catch(() => {});
  }, [isReady]);

  const safeChildren = Array.isArray(children) ? children : [];

  // Fetch submissions with pagination
  useEffect(() => {
    if (!isReady) return;

    const isLoadMore = offset > 0;
    if (isLoadMore) {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setLoading(true);
      setError(null);
    }

    const params = new URLSearchParams();
    if (childFilter !== null) params.set("child_id", String(childFilter));
    if (subjectFilter) params.set("subject", subjectFilter);
    params.set("limit", String(LIMIT));
    params.set("offset", String(offset));

    apiGet<SubmissionListResponse>(`/api/submissions?${params.toString()}`)
      .then((data) => {
        setSubmissions((prev) =>
          offset === 0 ? data.items : [...prev, ...data.items],
        );
        setTotal(data.total);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "加载失败";
        if (isLoadMore) {
          setLoadMoreError(msg);
        } else {
          setError(msg);
        }
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [isReady, childFilter, subjectFilter, offset, retryKey]);

  const handleChildFilterChange = (value: string) => {
    const id = value ? Number(value) : null;
    setChildFilter(id);
    setSubmissions([]);
    setOffset(0);
  };

  const handleSubjectFilterChange = (value: string) => {
    setSubjectFilter(value);
    setSubmissions([]);
    setOffset(0);
  };

  const handleLoadMore = () => {
    setOffset((prev) => prev + LIMIT);
  };

  const handleRetry = () => {
    setRetryKey((prev) => prev + 1);
  };

  const hasMore = submissions.length < total;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-16">
      {/* Top bar */}
      <header className="flex items-center py-4">
        <h1 className="text-[22px] font-semibold leading-[30px] text-text-primary">
          批改历史
        </h1>
      </header>

      {/* Phone setup */}
      {!isReady && (
        <div className="mb-6 rounded-[14px] border border-border-light bg-white p-4 shadow-sm">
          <label className="mb-2 block text-[13px] font-medium text-text-secondary">
            请输入家长手机号
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="13800138000"
            maxLength={11}
            className="w-full rounded-[10px] border border-border px-4 py-3 text-[15px] text-text-primary placeholder-[#A39D97] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-text-tertiary">
            手机号仅用于区分数据，不验证真伪
          </p>
        </div>
      )}

      {/* Filter bar — sticky below the top bar */}
      {isReady && (
        <div className="sticky top-0 z-10 -mx-4 flex gap-3 bg-white px-4 py-3">
          <select
            value={childFilter ?? ""}
            onChange={(e) => handleChildFilterChange(e.target.value)}
            className="flex-1 rounded-[10px] border border-border bg-white px-3 py-3 text-[15px] text-text-primary focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
          >
            <option value="">全部</option>
            {safeChildren.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={subjectFilter}
            onChange={(e) => handleSubjectFilterChange(e.target.value)}
            className="flex-1 rounded-[10px] border border-border bg-white px-3 py-3 text-[15px] text-text-primary focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
          >
            <option value="">全部</option>
            <option value="english">英语</option>
            <option value="math">数学</option>
          </select>
        </div>
      )}

      {/* Content area */}
      {isReady && (
        <div className="flex flex-1 flex-col">
          {/* Loading skeletons */}
          {loading && (
            <div className="mt-4 flex flex-col gap-3" data-testid="loading">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-[14px] border border-border-light bg-white p-3 shadow-sm"
                >
                  <Skeleton className="h-16 w-16 flex-shrink-0 rounded-[10px]" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-3 w-32 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center py-12">
              <span className="text-5xl">😞</span>
              <p className="mt-4 text-[15px] text-error">{error}</p>
              <button
                onClick={handleRetry}
                className="mt-6 min-h-11 rounded-xl bg-accent px-6 py-2 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover"
              >
                重试
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && submissions.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center py-12">
              <span className="text-5xl">📋</span>
              <p className="mt-4 text-center text-[15px] leading-relaxed text-text-secondary">
                还没有批改记录。
                <br />
                去批改一张试卷吧！
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-6 min-h-11 rounded-xl bg-accent px-6 py-2 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover"
              >
                去批改
              </button>
            </div>
          )}

          {/* Card list */}
          {!loading && !error && submissions.length > 0 && (
            <>
              <div className="mt-4 flex flex-col gap-3">
                {submissions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/submissions/${item.id}`)}
                    className="flex w-full items-center gap-3 rounded-[14px] border border-border-light bg-white p-3 text-left shadow-sm transition-colors hover:bg-[#F9F8F6]"
                  >
                    {/* Thumbnail */}
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-[10px] bg-brand-hover">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                          <FileText size={24} strokeWidth={1.5} />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-1 flex-col min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[15px] font-medium text-text-primary">
                          {item.child_name}
                        </span>
                        <span className="ml-2 flex-shrink-0 rounded-full bg-accent-subtle px-2.5 py-0.5 text-[11px] font-medium text-accent">
                          {item.subject === "english" ? "英语" : "数学"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        {item.score ? (
                          <span className="font-mono text-[13px] font-medium text-success">
                            ✅ {item.score.correct}/{item.score.total}
                          </span>
                        ) : (
                          <span className="text-[13px] text-text-tertiary">
                            批改中…
                          </span>
                        )}
                        <span className="text-[11px] text-text-tertiary">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="mt-4 pb-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full min-h-11 rounded-xl border border-border bg-white py-3 text-[15px] font-medium text-accent transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingMore ? "加载中…" : "加载更多"}
                  </button>
                  {loadMoreError && (
                    <p className="mt-2 text-center text-[13px] text-error">
                      {loadMoreError}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
