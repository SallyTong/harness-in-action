import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";

describe("HomePage", () => {
  it("renders title and upload area", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText("作业批改")).toBeInTheDocument();
    expect(screen.getByText("拍照上传试卷")).toBeInTheDocument();
    expect(screen.getByText("开始批改")).toBeInTheDocument();
  });

  it("shows phone input when phone not set", () => {
    localStorage.removeItem("parent_phone");
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const inputs = screen.getAllByPlaceholderText("13800138000");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });
});
