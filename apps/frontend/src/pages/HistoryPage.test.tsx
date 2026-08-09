import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HistoryPage from "./HistoryPage";

// Mock apiGet with path-aware implementation
const mockApiGet = vi.fn();
vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

const PHONE_KEY = "parent_phone";

function setPhone(value: string) {
  localStorage.setItem(PHONE_KEY, value);
}

function clearPhone() {
  localStorage.removeItem(PHONE_KEY);
}

/** Default mock: children returns [], submissions returns empty page */
function useDefaultMock() {
  mockApiGet.mockImplementation((path: string) => {
    if (String(path).startsWith("/api/children")) return Promise.resolve([]);
    if (String(path).startsWith("/api/submissions"))
      return Promise.resolve({ items: [], total: 0 });
    return Promise.resolve(null);
  });
}

describe("HistoryPage", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    useDefaultMock();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("phone input", () => {
    it("shows phone input when phone is not set", () => {
      clearPhone();
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );
      expect(screen.getByText("请输入家长手机号")).toBeInTheDocument();
    });

    it("does not show phone input when phone is set", () => {
      setPhone("13800138000");
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );
      expect(
        screen.queryByText("请输入家长手机号"),
      ).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("renders skeleton cards while loading", async () => {
      setPhone("13800138000");
      // Keep API calls pending forever
      mockApiGet.mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const skeletons = document.querySelectorAll(
          '[data-testid="loading"]',
        );
        expect(skeletons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("error state", () => {
    it("renders error message with retry button on fetch failure", async () => {
      setPhone("13800138000");
      // Children succeeds, but submissions (and everything else) fails
      mockApiGet.mockImplementation((path: string) => {
        if (String(path).startsWith("/api/children"))
          return Promise.resolve([]);
        return Promise.reject(new Error("网络错误"));
      });

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("网络错误")).toBeInTheDocument();
      });
      expect(screen.getByText("重试")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders empty message with action button when no submissions", async () => {
      setPhone("13800138000");
      // Default mock already returns empty

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/还没有批改记录/),
        ).toBeInTheDocument();
      });
      expect(screen.getByText("去批改")).toBeInTheDocument();
    });
  });

  describe("data display", () => {
    it("renders submission cards with child name, subject badge, and score", async () => {
      setPhone("13800138000");
      mockApiGet.mockImplementation((path: string) => {
        if (String(path).startsWith("/api/children"))
          return Promise.resolve([]);
        return Promise.resolve({
          items: [
            {
              id: 1,
              child_id: 1,
              child_name: "小明",
              subject: "math" as const,
              status: "completed" as const,
              score: { correct: 8, total: 10 },
              thumbnail_url: null,
              created_at: new Date().toISOString(),
            },
            {
              id: 2,
              child_id: 2,
              child_name: "小红",
              subject: "english" as const,
              status: "completed" as const,
              score: { correct: 9, total: 10 },
              thumbnail_url: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 2,
        });
      });

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("小明")).toBeInTheDocument();
      });
      expect(screen.getByText("小红")).toBeInTheDocument();

      // "数学" and "英语" appear in select options AND in card badges
      const mathEls = screen.getAllByText("数学");
      const engEls = screen.getAllByText("英语");
      expect(mathEls.length).toBeGreaterThanOrEqual(1);
      expect(engEls.length).toBeGreaterThanOrEqual(1);

      // Score emoji badges
      const checkMarks = screen.getAllByText(/✅/);
      expect(checkMarks.length).toBeGreaterThanOrEqual(2);
    });

    it("shows 批改中 for non-completed submissions", async () => {
      setPhone("13800138000");
      mockApiGet.mockImplementation((path: string) => {
        if (String(path).startsWith("/api/children"))
          return Promise.resolve([]);
        return Promise.resolve({
          items: [
            {
              id: 3,
              child_id: 1,
              child_name: "小明",
              subject: "english" as const,
              status: "processing" as const,
              score: null,
              thumbnail_url: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
        });
      });

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("批改中…")).toBeInTheDocument();
      });
    });
  });

  describe("filter", () => {
    it("renders child and subject filter dropdowns", async () => {
      setPhone("13800138000");
      mockApiGet.mockImplementation((path: string) => {
        if (String(path).startsWith("/api/children"))
          return Promise.resolve([
            { id: 1, name: "小明", submission_count: 5, created_at: "" },
            { id: 2, name: "小红", submission_count: 3, created_at: "" },
          ]);
        return Promise.resolve({ items: [], total: 0 });
      });

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("小明")).toBeInTheDocument();
      });

      // "全部" appears in both select dropdowns
      const allOptions = screen.getAllByText("全部");
      expect(allOptions.length).toBeGreaterThanOrEqual(2);

      expect(screen.getByText("小红")).toBeInTheDocument();

      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBe(2);
    });
  });

  describe("load more", () => {
    it("shows load more button when there are more items", async () => {
      setPhone("13800138000");
      mockApiGet.mockImplementation((path: string) => {
        if (String(path).startsWith("/api/children"))
          return Promise.resolve([]);
        return Promise.resolve({
          items: Array.from({ length: 20 }, (_, i) => ({
            id: i + 1,
            child_id: 1,
            child_name: `学生${i + 1}`,
            subject: "math" as const,
            status: "completed" as const,
            score: { correct: 8, total: 10 },
            thumbnail_url: null,
            created_at: new Date().toISOString(),
          })),
          total: 50,
        });
      });

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText("加载更多")).toBeInTheDocument();
      });
    });

    it("does not show load more when all items loaded", async () => {
      setPhone("13800138000");
      // Default mock returns empty — total=0 so hasMore=false

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>,
      );

      // Wait for empty state to appear
      await waitFor(() => {
        expect(
          screen.getByText(/还没有批改记录/),
        ).toBeInTheDocument();
      });

      expect(screen.queryByText("加载更多")).not.toBeInTheDocument();
    });
  });
});
