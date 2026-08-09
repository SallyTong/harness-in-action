import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ChildrenPage from "./pages/ChildrenPage";
import ProcessingPage from "./pages/ProcessingPage";
import ResultPage from "./pages/ResultPage";
import HistoryPage from "./pages/HistoryPage";
import HistoryDetailPage from "./pages/HistoryDetailPage";
import ErrorBookPage from "./pages/ErrorBookPage";
import ErrorGeneratePage from "./pages/ErrorGeneratePage";
import BottomNav from "./components/layout/BottomNav";

function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="text-center">
        <p className="text-lg font-semibold text-text-primary">页面不存在</p>
        <p className="mt-1 text-[13px] text-text-tertiary">请检查链接是否正确</p>
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
          path="/submissions/:id/processing"
          element={<ProcessingPage />}
        />
        <Route
          path="/submissions/:id/result"
          element={<ResultPage />}
        />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/submissions/:id" element={<HistoryDetailPage />} />
        <Route path="/errors" element={<ErrorBookPage />} />
        <Route path="/errors/generate" element={<ErrorGeneratePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <BottomNav />
    </>
  );
}
