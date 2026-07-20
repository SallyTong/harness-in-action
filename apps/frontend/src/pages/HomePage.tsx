import { useState } from "react";

export default function HomePage() {
  const [backendStatus, setBackendStatus] = useState<string | null>(null);

  const checkBackend = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setBackendStatus(`${data.service} v${data.version} — ${data.status}`);
    } catch {
      setBackendStatus("❌ 后端未连接");
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 flex size-20 items-center justify-center rounded-2xl bg-indigo-500 text-3xl shadow-lg">
        ✏️
      </div>

      <h1 className="mb-2 text-2xl font-bold tracking-tight">AI 作业批改</h1>
      <p className="mb-8 text-center text-gray-500">
        拍照上传试卷，AI 自动批改标注
      </p>

      {/* Placeholder for photo upload */}
      <div className="mb-6 flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 transition-colors hover:border-indigo-400">
        <span className="mb-2 text-4xl">📸</span>
        <span className="text-sm font-medium text-gray-500">拍照上传试卷</span>
        <span className="mt-1 text-xs text-gray-400">
          支持英语 · 数学 · 打印体 + 手写
        </span>
      </div>

      {/* Backend health check */}
      <button
        onClick={checkBackend}
        className="mb-4 rounded-xl bg-indigo-500 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-600 active:scale-95"
      >
        检测后端连接
      </button>

      {backendStatus && (
        <p className="rounded-lg bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
          {backendStatus}
        </p>
      )}
    </div>
  );
}
