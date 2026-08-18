import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import QuestionText from "./QuestionText";

describe("QuestionText", () => {
  it("renders English question text as plain text", () => {
    const { getByText } = render(
      <QuestionText
        subject="english"
        questionText="Choose the correct word."
        questionLatex={null}
      />,
    );
    expect(getByText("Choose the correct word.")).toBeInTheDocument();
  });

  it("renders Math question LaTeX via KaTeX", async () => {
    const { container } = render(
      <QuestionText subject="math" questionText={null} questionLatex="\\frac{1}{2}" />,
    );
    await waitFor(() => {
      expect(container.querySelector(".katex")).not.toBeNull();
    });
  });

  it("does not render anchors from \\href when trust is disabled", async () => {
    const { container } = render(
      <QuestionText
        subject="math"
        questionText={null}
        questionLatex="\\href{javascript:alert(1)}{click}"
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".katex")).not.toBeNull();
    });
    expect(container.querySelector("a")).toBeNull();
  });

  it("escapes raw HTML tags embedded in LaTeX source", async () => {
    const { container } = render(
      <QuestionText
        subject="math"
        questionText={null}
        questionLatex="\\text{<img src=x onerror=alert(1)>}"
      />,
    );
    await waitFor(() => {
      expect(container.querySelector(".katex")).not.toBeNull();
    });
    expect(container.querySelector("img")).toBeNull();
  });

  it("returns nothing when there is no stem text", () => {
    const { container } = render(
      <QuestionText subject="math" questionText={null} questionLatex={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
