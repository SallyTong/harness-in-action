import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ErrorBookPage from "./ErrorBookPage";

const mockApiGet = vi.fn();
vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

const ERROR_ITEM = {
  id: 1, submission_id: 10, child_id: 1, child_name: "小明",
  subject: "english", question_number: "2", question_type: "fill_blank",
  question_image_path: "http://test/api/images/questions/10_2.jpg?phone=13800138000",
  solution_note: "正确答案应为 'have gone'。",
  error_category: "grammar", error_count: 2,
  error_timestamps: ["2026-08-01T10:00:00Z"],
  is_manually_fixed: false,
  last_error_at: "2026-08-09T10:00:00Z", created_at: "2026-08-01T10:00:00Z",
};

describe("ErrorBookPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("parent_phone", "13800138000");
  });

  it("shows congratulations when no errors", async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (String(path).startsWith("/api/children"))
        return Promise.resolve([{ id: 1, name: "小明", submission_count: 0 }]);
      if (String(path).startsWith("/api/error-collections"))
        return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve(null);
    });

    render(<MemoryRouter><ErrorBookPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText("还没有错题。继续保持！")).toBeInTheDocument();
    });
  });
});
