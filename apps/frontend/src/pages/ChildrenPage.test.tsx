import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ChildrenPage from "./ChildrenPage";

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));

const mockUsePhone = vi.fn();
vi.mock("../hooks/usePhone", () => ({
  usePhone: () => mockUsePhone(),
}));

describe("ChildrenPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUsePhone.mockReturnValue({ phone: "13800138000", isReady: true });
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({ id: 99, name: "new", submission_count: 0 });
    mockApiPut.mockResolvedValue({});
    mockApiDelete.mockResolvedValue({});
  });

  it("renders children list", async () => {
    mockApiGet.mockResolvedValue([
      { id: 1, name: "小明", submission_count: 5 },
      { id: 2, name: "小红", submission_count: 3 },
    ]);
    render(<MemoryRouter><ChildrenPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("小明")).toBeInTheDocument();
      expect(screen.getByText("小红")).toBeInTheDocument();
    });
  });

  it("shows empty prompt when no children", async () => {
    mockApiGet.mockResolvedValue([]);
    render(<MemoryRouter><ChildrenPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("请先添加小朋友")).toBeInTheDocument();
    });
  });
});
