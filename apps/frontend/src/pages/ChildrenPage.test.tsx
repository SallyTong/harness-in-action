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

  it("renders children list", async () => {
    mockApiGet.mockResolvedValue([
      { id: 1, name: "小明", submission_count: 5 },
      { id: 2, name: "小红", submission_count: 3 },
    ]);
    render(
      <MemoryRouter>
        <ChildrenPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("小明")).toBeInTheDocument();
      expect(screen.getByText("小红")).toBeInTheDocument();
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
