import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ErrorGeneratePage from "./ErrorGeneratePage";

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

describe("ErrorGeneratePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApiGet.mockImplementation((path: string) => {
      if (String(path).startsWith("/api/children"))
        return Promise.resolve([{ id: 1, name: "小明", submission_count: 0 }]);
      return Promise.resolve(null);
    });
  });

  it("defaults to text sheet format", async () => {
    render(
      <MemoryRouter initialEntries={["/errors/generate?child_id=1"]}>
        <ErrorGeneratePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("试卷格式")).toBeInTheDocument();
    expect(screen.getByText("文字试卷")).toBeInTheDocument();
    expect(screen.getByText("图片试卷")).toBeInTheDocument();
  });

  it("generates a text sheet and renders stems with a Word download link", async () => {
    mockApiPost.mockResolvedValue({
      format: "text",
      question_count: 1,
      image_url: null,
      questions: [
        {
          question_number: "3",
          question_type: "choice",
          subject: "english",
          question_text: "Choose the correct word.",
          question_latex: null,
          question_image_path: "https://example.com/q3.png",
          source_submission_id: 10,
        },
      ],
      docx_url: "https://example.com/sheet.docx",
    });

    render(
      <MemoryRouter initialEntries={["/errors/generate?child_id=1"]}>
        <ErrorGeneratePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /生成试卷/ }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/api/error-collections/generate",
        expect.objectContaining({ format: "text" }),
      );
    });

    expect(await screen.findByText("Choose the correct word.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /下载 Word/ })).toHaveAttribute(
      "href",
      "https://example.com/sheet.docx",
    );
  });

  it("switches to image format and renders the sheet image", async () => {
    mockApiPost.mockResolvedValue({
      format: "image",
      question_count: 5,
      image_url: "https://example.com/sheet.jpg",
      questions: null,
      docx_url: null,
    });

    render(
      <MemoryRouter initialEntries={["/errors/generate?child_id=1"]}>
        <ErrorGeneratePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /图片试卷/ }));
    fireEvent.click(screen.getByRole("button", { name: /生成试卷/ }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/api/error-collections/generate",
        expect.objectContaining({ format: "image" }),
      );
    });

    expect(await screen.findByAltText("错题试卷")).toBeInTheDocument();
    expect(screen.getByText("保存图片")).toBeInTheDocument();
  });
});
