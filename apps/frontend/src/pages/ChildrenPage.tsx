import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";
import { clearToken } from "../lib/auth";
import Toast, { type ToastType } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import type { Child } from "../types";

// Contract (openapi.yaml v0.2.0): grade is a string enum over the six primary
// school grades; note is optional (max 200 chars, pure display — no business
// logic). avatar is reserved and not edited/displayed in this phase.
const GRADES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"] as const;
const DEFAULT_GRADE = "五年级";
const NOTE_MAX_LENGTH = 200;

interface ChildFormValues {
  name: string;
  grade: string;
  note: string;
}

function ChildForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  values: ChildFormValues;
  onChange: (next: ChildFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const set = (patch: Partial<ChildFormValues>) => onChange({ ...values, ...patch });

  return (
    <div className="space-y-3 rounded-[14px] border border-border-light bg-white p-4 shadow-sm">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-text-secondary">名字</span>
        <input
          type="text"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="小朋友名字"
          maxLength={50}
          autoFocus
          className="w-full rounded-[10px] border border-border px-3 py-2.5 text-[15px] text-text-primary placeholder-[#A39D97] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-text-secondary">年级</span>
        <select
          value={values.grade}
          onChange={(e) => set({ grade: e.target.value })}
          className="w-full rounded-[10px] border border-border bg-white px-3 py-2.5 text-[15px] text-text-primary focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-text-secondary">
          <span>备注</span>
          <span className="text-[11px] font-normal text-text-tertiary">
            {values.note.length}/{NOTE_MAX_LENGTH}
          </span>
        </span>
        <textarea
          value={values.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="选填，最多 200 字"
          maxLength={NOTE_MAX_LENGTH}
          rows={2}
          className="w-full resize-none rounded-[10px] border border-border px-3 py-2.5 text-[15px] leading-relaxed text-text-primary placeholder-[#A39D97] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="min-h-11 rounded-xl px-4 py-2 text-[14px] font-medium text-text-secondary transition-colors hover:bg-brand-hover"
        >
          取消
        </button>
        <button
          onClick={onSubmit}
          disabled={!values.name.trim()}
          className="min-h-11 rounded-xl bg-accent px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

const emptyForm = (): ChildFormValues => ({
  name: "",
  grade: DEFAULT_GRADE,
  note: "",
});

export default function ChildrenPage() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<ChildFormValues>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ChildFormValues>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<Child | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const fetchChildren = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Child[]>("/api/children");
      setChildren(data);
    } catch {
      setError("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const handleAdd = async () => {
    const name = addForm.name.trim();
    if (!name) return;
    try {
      await apiPost("/api/children", {
        name,
        grade: addForm.grade,
        note: addForm.note.trim() || null,
      });
      setAddForm(emptyForm());
      setAdding(false);
      showToast("已添加" + name, "success");
      fetchChildren();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "添加失败", "error");
    }
  };

  const startEdit = (child: Child) => {
    setEditingId(child.id);
    setEditForm({ name: child.name, grade: child.grade, note: child.note ?? "" });
  };

  const handleEdit = async (child: Child) => {
    const name = editForm.name.trim();
    if (!name) return;
    try {
      await apiPut("/api/children/" + child.id, {
        name,
        grade: editForm.grade,
        note: editForm.note.trim() || null,
      });
      setEditingId(null);
      showToast("已保存修改", "success");
      fetchChildren();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "编辑失败", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete("/api/children/" + deleteTarget.id);
      setDeleteTarget(null);
      showToast("已移除" + deleteTarget.name, "success");
      fetchChildren();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败", "error");
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-16">
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={() => navigate("/")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-brand-hover"
          aria-label="返回"
        >
          <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
        <h1 className="text-[22px] font-semibold leading-[30px] text-text-primary">小朋友管理</h1>
      </header>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-[14px] bg-white p-4 shadow-sm">
              <div className="mb-2 h-5 w-24 rounded bg-brand-hover" />
              <div className="h-3 w-16 rounded bg-brand-hover" />
            </div>
          ))}
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-[15px] text-error">{error}</p>
          <button
            onClick={fetchChildren}
            className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white"
          >
            重试
          </button>
        </div>
      )}
      {!loading && !error && children.length === 0 && !adding && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-[15px] text-text-secondary">请先添加小朋友</p>
          <button
            onClick={() => setAdding(true)}
            className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white"
          >
            添加
          </button>
        </div>
      )}
      {!loading && !error && (children.length > 0 || adding) && (
        <div className="space-y-3">
          {children.map((child) =>
            editingId === child.id ? (
              <ChildForm
                key={child.id}
                values={editForm}
                onChange={setEditForm}
                onSubmit={() => handleEdit(child)}
                onCancel={() => setEditingId(null)}
                submitLabel="保存修改"
              />
            ) : (
              <div
                key={child.id}
                className="flex items-start gap-3 rounded-[14px] bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => startEdit(child)}
                      className="text-left text-[18px] font-medium leading-[26px] text-text-primary transition-colors hover:text-accent"
                    >
                      {child.name}
                    </button>
                    <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-[12px] font-medium text-accent">
                      {child.grade}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-[18px] text-text-tertiary">
                    已批改 {child.submission_count} 次
                  </p>
                  {child.note && child.note.trim() && (
                    <p className="mt-1 truncate text-[13px] leading-[18px] text-text-secondary">
                      {child.note}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setDeleteTarget(child)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-tertiary transition-colors hover:bg-error-bg hover:text-error"
                  aria-label={"删除 " + child.name}
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              </div>
            ),
          )}

          {adding ? (
            <ChildForm
              values={addForm}
              onChange={setAddForm}
              onSubmit={handleAdd}
              onCancel={() => {
                setAdding(false);
                setAddForm(emptyForm());
              }}
              submitLabel="确认"
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-[15px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              <Plus size={18} strokeWidth={1.5} />
              添加小朋友
            </button>
          )}
        </div>
      )}

      {/* Logout */}
      <div className="mt-8 pb-4">
        <button
          onClick={handleLogout}
          className="w-full min-h-11 rounded-xl border border-border bg-white py-3 text-[15px] font-medium text-error transition-colors hover:bg-error-bg"
        >
          登出
        </button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除"
        message={"删除" + (deleteTarget?.name ?? "") + "？删除后历史试卷保留。"}
        confirmLabel="移除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
