import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { usePhone } from "../hooks/usePhone";
import { apiGet } from "../lib/api";

interface Child {
  id: number;
  name: string;
  submission_count: number;
}

export default function HomePage() {
  const { phone, setPhone, isReady } = usePhone();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [subject, setSubject] = useState<"english" | "math">("english");

  useEffect(() => {
    if (!isReady) return;
    apiGet<Child[]>("/api/children")
      .then(setChildren)
      .catch(() => {});
  }, [isReady]);

  const handleChildChange = (id: number) => setSelectedChildId(id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-16">
      {/* Top bar */}
      <header className="flex items-center justify-between py-4">
        <h1 className="text-[22px] font-semibold leading-[30px] text-[#1E1B18]">
          作业批改
        </h1>
        <button
          onClick={() => navigate("/children")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#A39D97] transition-colors hover:bg-[#F3F0ED] hover:text-[#6B6560]"
          aria-label="小朋友管理"
        >
          <User size={22} strokeWidth={1.5} />
        </button>
      </header>

      {/* Phone setup */}
      {!isReady && (
        <div className="mb-6 rounded-[14px] border border-[#F0EDE8] bg-white p-4 shadow-sm">
          <label className="mb-2 block text-[13px] font-medium text-[#6B6560]">
            请输入家长手机号
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="13800138000"
            maxLength={11}
            className="w-full rounded-[10px] border border-[#E5E0DA] px-4 py-3 text-[15px] text-[#1E1B18] placeholder-[#A39D97] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-[#A39D97]">
            手机号仅用于区分数据，不验证真伪
          </p>
        </div>
      )}

      {/* Child selector + subject */}
      {isReady && (
        <div className="mb-6 flex items-center gap-3">
          <select
            value={selectedChildId ?? ""}
            onChange={(e) => handleChildChange(Number(e.target.value))}
            className="flex-1 rounded-[10px] border border-[#E5E0DA] bg-white px-3 py-3 text-[15px] text-[#1E1B18] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1] focus:outline-none"
          >
            {children.length === 0 && (
              <option value="">请先添加小朋友</option>
            )}
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-[10px] border border-[#E5E0DA] bg-white p-0.5">
            <button
              onClick={() => setSubject("english")}
              className={`min-h-11 rounded-[8px] px-4 text-[15px] font-medium transition-colors ${
                subject === "english"
                  ? "bg-[#6366F1] text-white"
                  : "text-[#6B6560]"
              }`}
            >
              英语
            </button>
            <button
              onClick={() => setSubject("math")}
              className={`min-h-11 rounded-[8px] px-4 text-[15px] font-medium transition-colors ${
                subject === "math"
                  ? "bg-[#6366F1] text-white"
                  : "text-[#6B6560]"
              }`}
            >
              数学
            </button>
          </div>
        </div>
      )}

      {/* Upload area placeholder */}
      <div className="mb-6 flex flex-1 flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[#E5E0DA] bg-white p-8 transition-colors hover:border-[#6366F1]">
        <span className="mb-3 text-5xl">📸</span>
        <span className="text-[15px] font-medium text-[#6B6560]">
          拍照上传试卷
        </span>
        <span className="mt-1 text-[13px] text-[#A39D97]">
          支持英语 · 数学 · 打印体 + 手写
        </span>
      </div>

      {/* Submit button */}
      <button
        disabled
        className="w-full rounded-xl bg-[#6366F1] py-3 text-[15px] font-medium text-white opacity-50 shadow-sm"
      >
        开始批改
      </button>
      <p className="mt-2 text-center text-[11px] text-[#A39D97]">
        拍照上传功能即将推出
      </p>
    </div>
  );
}
