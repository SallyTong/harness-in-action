import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";

const mockApiGet = vi.fn();
const mockApiUpload = vi.fn();
vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiUpload: (...args: unknown[]) => mockApiUpload(...args),
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue([]);
  });

  it("renders title and upload zone", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText("作业批改")).toBeInTheDocument();
    expect(screen.getByText("拍照上传试卷")).toBeInTheDocument();
    expect(screen.getByText("开始批改")).toBeInTheDocument();
  });
});
