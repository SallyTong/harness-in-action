import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResultPage from "./ResultPage";

const mockApiGet = vi.fn();
const mockApiPatch = vi.fn();
vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
}));

const COMPLETED = {
  id: 1,
  child_id: 1,
  child_name: "小明",
  subject: "english",
  status: "completed",
  score: { correct: 3, total: 4 },
  thumbnail_url: null,
  original_image_url: "http://test/api/images/originals/1.jpg?token=signed&expires=9999999999",
  annotated_image_url: "http://test/api/images/annotated/1.jpg?token=signed&expires=9999999999",
  total_questions: 4,
  correct_count: 3,
  token_usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  questions: [
    {
      id: 1,
      question_number: "1",
      question_type: "choice",
      is_correct: true,
      solution_note: null,
      error_category: null,
      is_manually_fixed: false,
    },
    {
      id: 2,
      question_number: "2",
      question_type: "fill_blank",
      is_correct: false,
      solution_note: "正确答案应为 'have gone'。",
      error_category: "grammar",
      is_manually_fixed: false,
    },
  ],
  created_at: "2026-08-09T10:00:00Z",
  updated_at: "2026-08-09T10:05:00Z",
};

function renderRoute(submissionId = "1") {
  return render(
    <MemoryRouter initialEntries={[`/submissions/${submissionId}/result`]}>
      <Routes>
        <Route path="/submissions/:id/result" element={<ResultPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResultPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders score and questions when completed", async () => {
    mockApiGet.mockResolvedValue(COMPLETED);
    renderRoute();

    await waitFor(() => {
      expect(screen.getByText("小明")).toBeInTheDocument();
    });
    expect(screen.getByText("逐题明细")).toBeInTheDocument();
  });
});
