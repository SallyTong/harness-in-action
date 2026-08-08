import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChildrenPage from "./pages/ChildrenPage";
import BottomNav from "./components/layout/BottomNav";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <p className="text-[15px] text-[#6B6560]">{title}</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="text-center">
        <p className="text-lg font-semibold text-[#1E1B18]">页面不存在</p>
        <p className="mt-1 text-[13px] text-[#A39D97]">请检查链接是否正确</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/children" element={<ChildrenPage />} />
        <Route
          path="/history"
          element={<PlaceholderPage title="批改历史（即将推出）" />}
        />
        <Route
          path="/errors"
          element={<PlaceholderPage title="错题集（即将推出）" />}
        />
        <Route
          path="/errors/generate"
          element={<PlaceholderPage title="错题试卷生成（即将推出）" />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <BottomNav />
    </>
  );
}
