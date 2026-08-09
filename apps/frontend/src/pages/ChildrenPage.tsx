import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { usePhone } from "../hooks/usePhone";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";
import Toast, { type ToastType } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";

interface Child {
  id: number;
  name: string;
  submission_count: number;
}

export default function ChildrenPage() {
  const navigate = useNavigate();
  const { phone, isReady } = usePhone();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Child | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const fetchChildren = useCallback(async () => {
    if (!isReady) return;
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
  }, [isReady]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await apiPost("/api/children", { name });
      setNewName("");
      setAdding(false);
      showToast("已添加" + name, "success");
      fetchChildren();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "添加失败", "error");
    }
  };

  const handleEdit = async (child: Child) => {
    if (editingId === child.id) {
      const name = editName.trim();
      if (!name || name === child.name) {
        setEditingId(null);
        return;
      }
      try {
        await apiPut("/api/children/" + child.id, { name });
        setEditingId(null);
        showToast("已改名为" + name, "success");
        fetchChildren();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "编辑失败", "error");
      }
    } else {
      setEditingId(child.id);
      setEditName(child.name);
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
        <h1 className="text-[22px] font-semibold leading-[30px] text-text-primary">
          小朋友管理
        </h1>
      </header>
      <p className="mb-4 text-[13px] text-text-tertiary">手机号：{phone}</p>
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-[14px] bg-white p-4 shadow-sm"
            >
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
      {!loading && !error && children.length === 0 && (
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
      {!loading && !error && children.length > 0 && (
        <div className="space-y-3">
          {children.map((child) => (
            <div
              key={child.id}
              className="flex items-center gap-3 rounded-[14px] bg-white p-4 shadow-sm"
            >
              <div className="flex-1">
                {editingId === child.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    className="w-full rounded-[10px] border border-accent px-3 py-2 text-[18px] font-medium text-text-primary focus:ring-2 focus:ring-accent focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit(child);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => handleEdit(child)}
                    className="text-left text-[18px] font-medium leading-[26px] text-text-primary transition-colors hover:text-accent"
                  >
                    {child.name}
                  </button>
                )}
                <p className="mt-1 text-[13px] leading-[18px] text-text-tertiary">
                  已批改 {child.submission_count} 次
                </p>
              </div>
              {editingId === child.id ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="min-h-11 rounded-xl px-3 py-2 text-[13px] text-text-secondary transition-colors hover:bg-brand-hover"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleEdit(child)}
                    className="min-h-11 rounded-xl bg-accent px-3 py-2 text-[13px] font-medium text-white"
                  >
                    保存
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteTarget(child)}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-tertiary transition-colors hover:bg-error-bg hover:text-error"
                  aria-label={"删除 " + child.name}
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-[15px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              <Plus size={18} strokeWidth={1.5} />
              添加小朋友
            </button>
          )}
          {adding && (
            <div className="flex items-center gap-2 rounded-[14px] bg-white p-4 shadow-sm">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="小朋友名字"
                maxLength={50}
                className="flex-1 rounded-[10px] border border-border px-3 py-3 text-[15px] text-text-primary placeholder-[#A39D97] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                  }
                }}
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="min-h-11 rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                确认
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                }}
                className="min-h-11 rounded-xl px-3 py-2 text-[13px] text-text-secondary transition-colors hover:bg-brand-hover"
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除"
        message={"删除" + (deleteTarget?.name ?? "") + "？删除后历史试卷保留。"}
        confirmLabel="移除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
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
