import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./LoginPage";

const mockApiPostPublic = vi.fn();
vi.mock("../lib/api", () => ({
  apiPostPublic: (...args: unknown[]) => mockApiPostPublic(...args),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>首页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApiPostPublic.mockResolvedValue({ retry_after: 60 });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders login form", () => {
    renderLogin();
    expect(screen.getByText("欢迎使用")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("请输入 11 位手机号")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("6 位验证码")).toBeInTheDocument();
  });

  it("sends code and starts countdown", async () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("请输入 11 位手机号"), {
      target: { value: "13800138000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await waitFor(() => {
      expect(mockApiPostPublic).toHaveBeenCalledWith("/api/auth/send-code", {
        phone: "13800138000",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("60s 后重发")).toBeInTheDocument();
    });
  });

  it("logs in, stores token, and navigates home", async () => {
    mockApiPostPublic.mockImplementation((path: string) => {
      if (path === "/api/auth/login") {
        return Promise.resolve({
          token: "jwt-token-123",
          token_type: "Bearer",
          expires_at: "2026-09-17T00:00:00Z",
          user_id: 1,
        });
      }
      return Promise.resolve({ retry_after: 60 });
    });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("请输入 11 位手机号"), {
      target: { value: "13800138000" },
    });
    fireEvent.change(screen.getByPlaceholderText("6 位验证码"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByText("首页")).toBeInTheDocument();
    });
    expect(localStorage.getItem("auth_token")).toBe("jwt-token-123");
  });

  it("shows error on wrong code", async () => {
    mockApiPostPublic.mockImplementation((path: string) => {
      if (path === "/api/auth/login") {
        return Promise.reject(new Error("Invalid or expired verification code"));
      }
      return Promise.resolve({ retry_after: 60 });
    });

    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("请输入 11 位手机号"), {
      target: { value: "13800138000" },
    });
    fireEvent.change(screen.getByPlaceholderText("6 位验证码"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid or expired verification code")).toBeInTheDocument();
    });
  });
});
