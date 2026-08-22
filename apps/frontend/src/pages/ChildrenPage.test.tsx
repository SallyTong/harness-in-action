import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ChildrenPage from "./ChildrenPage";
import { setToken } from "../lib/auth";

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

const child = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: "小明",
  grade: "三年级",
  note: null,
  avatar: null,
  submission_count: 5,
  created_at: "2026-07-01T00:00:00Z",
  ...overrides,
});

describe("ChildrenPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({ id: 99, name: "new", submission_count: 0 });
    mockApiPut.mockResolvedValue({});
    mockApiDelete.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children list with grade and note", async () => {
    mockApiGet.mockResolvedValue([
      child({ id: 1, name: "小明", grade: "三年级", note: "喜欢数学" }),
      child({ id: 2, name: "小红", grade: "五年级", note: null }),
    ]);
    render(
      <MemoryRouter>
        <ChildrenPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("小明")).toBeInTheDocument();
      expect(screen.getByText("小红")).toBeInTheDocument();
      expect(screen.getByText("三年级")).toBeInTheDocument();
      expect(screen.getByText("喜欢数学")).toBeInTheDocument();
    });
  });

  it("shows empty prompt when no children", async () => {
    mockApiGet.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <ChildrenPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("请先添加小朋友")).toBeInTheDocument();
    });
  });

  it("adds a child with grade and note", async () => {
    mockApiGet.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <ChildrenPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("请先添加小朋友")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("添加"));

    fireEvent.change(screen.getByPlaceholderText("小朋友名字"), {
      target: { value: "小刚" },
    });
    fireEvent.change(screen.getByLabelText("年级"), { target: { value: "四年级" } });
    fireEvent.change(screen.getByPlaceholderText("选填，最多 200 字"), {
      target: { value: "数学较弱" },
    });

    fireEvent.click(screen.getByText("确认"));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/children", {
        name: "小刚",
        grade: "四年级",
        note: "数学较弱",
      });
    });
  });

  it("edits a child's grade and note", async () => {
    mockApiGet.mockResolvedValue([child({ id: 1, name: "小明", grade: "三年级", note: null })]);
    render(
      <MemoryRouter>
        <ChildrenPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("小明")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("小明"));

    fireEvent.change(await screen.findByLabelText("年级"), { target: { value: "六年级" } });
    fireEvent.change(screen.getByPlaceholderText("选填，最多 200 字"), {
      target: { value: "喜欢数学" },
    });

    fireEvent.click(screen.getByText("保存修改"));

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith("/api/children/1", {
        name: "小明",
        grade: "六年级",
        note: "喜欢数学",
      });
    });
  });

  it("logs out, clears token, and navigates to login", async () => {
    setToken("test-token");
    mockApiGet.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={["/children"]}>
        <Routes>
          <Route path="/children" element={<ChildrenPage />} />
          <Route path="/login" element={<div>登录页</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("登出")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("登出"));

    await waitFor(() => {
      expect(screen.getByText("登录页")).toBeInTheDocument();
    });
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});
