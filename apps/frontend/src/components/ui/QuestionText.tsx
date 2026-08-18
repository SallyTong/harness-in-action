import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface QuestionTextProps {
  subject: "english" | "math";
  questionText: string | null;
  questionLatex: string | null;
}

/**
 * Renders a question's transcribed stem text.
 *
 * - English questions → `question_text` (plain text). Rendered as a React text
 *   node so React escapes it automatically — no `dangerouslySetInnerHTML`.
 * - Math questions → `question_latex` rendered with KaTeX in `trust: false`
 *   mode. `trust: false` disables every HTML-bearing macro (`\href`, `\htmlClass`,
 *   `\htmlId`, `\htmlStyle`, …) and escapes text-mode `<>&`, so untrusted model
 *   output cannot inject markup. `throwOnError: false` renders the raw (escaped)
 *   source instead of throwing on malformed LaTeX.
 *
 * The stem text is model output and therefore untrusted input — do not relax
 * `trust` or switch this to `dangerouslySetInnerHTML` with raw content.
 *
 * Returns `null` when there is no usable text, so callers fall back to the
 * question screenshot rather than rendering an empty shell.
 */
export default function QuestionText({ subject, questionText, questionLatex }: QuestionTextProps) {
  const latexRef = useRef<HTMLDivElement>(null);

  const renderLatex = subject === "math" && !!questionLatex;
  const renderText = !renderLatex && !!questionText;

  useEffect(() => {
    if (!renderLatex || !latexRef.current || !questionLatex) return;
    try {
      katex.render(questionLatex, latexRef.current, {
        throwOnError: false,
        trust: false,
        displayMode: false,
      });
    } catch {
      // Even the throwOnError fallback failed — show the escaped raw source.
      latexRef.current.textContent = questionLatex;
    }
  }, [renderLatex, questionLatex]);

  if (renderLatex) {
    return (
      <div className="border-t border-border-light px-4 py-3">
        <p className="text-[11px] font-medium text-text-tertiary">题干</p>
        <div
          ref={latexRef}
          className="mt-1 overflow-x-auto text-[15px] leading-relaxed text-text-primary"
          aria-label="数学题干"
        />
      </div>
    );
  }

  if (renderText) {
    return (
      <div className="border-t border-border-light px-4 py-3">
        <p className="text-[11px] font-medium text-text-tertiary">题干</p>
        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-text-primary">
          {questionText}
        </p>
      </div>
    );
  }

  return null;
}
