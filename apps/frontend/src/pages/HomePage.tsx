import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User, X } from "lucide-react";
import { usePhone } from "../hooks/usePhone";
import { apiGet, apiUpload } from "../lib/api";
import { compressImage, isHeic } from "../lib/image";
import ActionSheet from "../components/ui/ActionSheet";
import Toast, { type ToastType } from "../components/ui/Toast";
import type { Child, SubmissionAccepted } from "../types";

export default function HomePage() {
  const { phone, setPhone, isReady } = usePhone();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [subject, setSubject] = useState<"english" | "math">("english");
  const [selectedImage, setSelectedImage] = useState<{
    blob: Blob;
    previewUrl: string;
  } | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isReady) return;
    apiGet<Child[]>("/api/children")
      .then(setChildren)
      .catch(() => {});
  }, [isReady]);

  const handleFileSelect = async (file: File) => {
    if (isHeic(file)) {
      setToast({
        message: "不支持 HEIC 格式。请在手机设置中将相机格式改为 JPEG。",
        type: "error",
      });
      return;
    }

    try {
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      setSelectedImage({ blob: compressed, previewUrl });
    } catch {
      setToast({
        message: "图片处理失败，请重试。",
        type: "error",
      });
    }
  };

  const handleRemoveImage = () => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage.previewUrl);
      setSelectedImage(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage || !selectedChildId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append(
        "image",
        selectedImage.blob,
        `exam_${Date.now()}.jpg`,
      );
      formData.append("subject", subject);
      formData.append("child_id", String(selectedChildId));

      const result = await apiUpload<SubmissionAccepted>(
        "/api/submissions",
        formData,
      );

      // Clean up preview URL
      URL.revokeObjectURL(selectedImage.previewUrl);
      setSelectedImage(null);
      setUploading(false);

      // Navigate to processing page
      navigate(`/submissions/${result.submission_id}/processing`);
    } catch (err) {
      setUploading(false);
      setToast({
        message: err instanceof Error ? err.message : "上传失败，请重试。",
        type: "error",
      });
    }
  };

  const canSubmit =
    isReady && selectedImage && selectedChildId !== null && !uploading;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-16">
      {/* Top bar */}
      <header className="flex items-center justify-between py-4">
        <h1 className="text-[22px] font-semibold leading-[30px] text-text-primary">
          作业批改
        </h1>
        <button
          onClick={() => navigate("/children")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-tertiary transition-colors hover:bg-brand-hover hover:text-text-secondary"
          aria-label="小朋友管理"
        >
          <User size={22} strokeWidth={1.5} />
        </button>
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

      {/* Child selector + subject */}
      {isReady && (
        <div className="mb-6 flex items-center gap-3">
          <select
            value={selectedChildId ?? ""}
            onChange={(e) =>
              setSelectedChildId(
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className="flex-1 rounded-[10px] border border-border bg-white px-3 py-3 text-[15px] text-text-primary focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
          >
            <option value="">
              {children.length === 0
                ? "请先添加小朋友"
                : "选择小朋友"}
            </option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-[10px] border border-border bg-white p-0.5">
            <button
              onClick={() => setSubject("english")}
              className={`min-h-11 rounded-[8px] px-4 text-[15px] font-medium transition-colors ${
                subject === "english"
                  ? "bg-accent text-white"
                  : "text-text-secondary"
              }`}
            >
              英语
            </button>
            <button
              onClick={() => setSubject("math")}
              className={`min-h-11 rounded-[8px] px-4 text-[15px] font-medium transition-colors ${
                subject === "math"
                  ? "bg-accent text-white"
                  : "text-text-secondary"
              }`}
            >
              数学
            </button>
          </div>
        </div>
      )}

      {/* Upload area */}
      {isReady && (
        <>
          {selectedImage ? (
            /* Image preview */
            <div className="mb-6 flex flex-col items-center">
              <div className="relative inline-block">
                <img
                  src={selectedImage.previewUrl}
                  alt="待上传试卷"
                  className="max-h-[300px] rounded-[16px] object-contain shadow-sm"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-error text-white shadow-md transition-colors hover:bg-red-600"
                  aria-label="移除图片"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
              <span className="mt-2 text-[13px] text-text-tertiary">
                已压缩，点击上方 X 可移除
              </span>
            </div>
          ) : (
            /* Upload zone */
            <button
              onClick={() => setShowActionSheet(true)}
              className="mb-6 flex flex-1 flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-border bg-white p-8 transition-colors hover:border-accent"
            >
              <span className="mb-3 text-5xl">📸</span>
              <span className="text-[15px] font-medium text-text-secondary">
                拍照上传试卷
              </span>
              <span className="mt-1 text-[13px] text-text-tertiary">
                支持英语 · 数学 · 打印体 + 手写
              </span>
            </button>
          )}
        </>
      )}

      {/* Submit button */}
      {isReady && (
        <>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full rounded-xl py-3 text-[15px] font-medium text-white shadow-sm transition-all ${
              canSubmit
                ? "bg-accent hover:bg-accent-hover"
                : "cursor-not-allowed bg-accent opacity-50"
            }`}
          >
            {uploading ? "上传中…" : "开始批改"}
          </button>
        </>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = "";
        }}
      />

      {/* ActionSheet */}
      <ActionSheet
        open={showActionSheet}
        options={[
          {
            label: "拍照",
            icon: "📷",
            onClick: () => cameraInputRef.current?.click(),
          },
          {
            label: "从相册选择",
            icon: "🖼️",
            onClick: () => galleryInputRef.current?.click(),
          },
        ]}
        onClose={() => setShowActionSheet(false)}
      />

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
