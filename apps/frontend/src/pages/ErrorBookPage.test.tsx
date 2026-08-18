import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ErrorBookPage from "./ErrorBookPage";

const mockApiGet = vi.fn();
vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

describe("ErrorBookPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows congratulations when no errors", async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (String(path).startsWith("/api/children"))
        return Promise.resolve([{ id: 1, name: "小明", submission_count: 0 }]);
      if (String(path).startsWith("/api/error-collections"))
        return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve(null);
    });

    render(
      <MemoryRouter>
        <ErrorBookPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("还没有错题。继续保持！")).toBeInTheDocument();
    });
  });

  it("renders transcribed stem text on an error card", async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (String(path).startsWith("/api/children")) return Promise.resolve([]);
      if (String(path).startsWith("/api/error-collections"))
        return Promise.resolve({
          items: [
            {
              id: 1,
              submission_id: 10,
              child_id: 1,
              child_name: "小明",
              subject: "english",
              question_number: "3",
              question_type: "choice",
              question_image_path: "https://example.com/q.png",
              question_text: "Choose the correct word.",
              question_latex: null,
              solution_note: null,
              error_category: null,
              error_count: 1,
              error_timestamps: [],
              is_manually_fixed: false,
              last_error_at: "2026-08-18T00:00:00Z",
              created_at: "2026-08-18T00:00:00Z",
            },
          ],
          total: 1,
        });
      return Promise.resolve(null);
    });

    render(
      <MemoryRouter>
        <ErrorBookPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Choose the correct word.")).toBeInTheDocument();
    });
  });
});
