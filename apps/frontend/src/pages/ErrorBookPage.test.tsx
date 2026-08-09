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
