import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { setToken } from "./lib/auth";

const mockApiGet = vi.fn();
const mockApiUpload = vi.fn();
vi.mock("./lib/api", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  apiUpload: (...args: unknown[]) => mockApiUpload(...args),
  apiPostPublic: vi.fn(),
}));

describe("App routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApiGet.mockImplementation((path: string) => {
      if (String(path).startsWith("/api/submissions"))
        return Promise.resolve({ items: [], total: 0 });
      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects to login when not authenticated", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("欢迎使用")).toBeInTheDocument();
  });

  it("renders home page at / when authenticated", () => {
    setToken("test-token");
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("作业批改")).toBeInTheDocument();
  });

  it("renders login page at /login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("欢迎使用")).toBeInTheDocument();
  });

  it("renders children page at /children when authenticated", () => {
    setToken("test-token");
    render(
      <MemoryRouter initialEntries={["/children"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("小朋友管理")).toBeInTheDocument();
  });

  it("renders history page at /history when authenticated", () => {
    setToken("test-token");
    render(
      <MemoryRouter initialEntries={["/history"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("批改历史")).toBeInTheDocument();
  });
});
