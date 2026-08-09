import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

describe("App routing", () => {
  it("renders home page at /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("作业批改")).toBeInTheDocument();
  });

  it("renders children page at /children", () => {
    render(
      <MemoryRouter initialEntries={["/children"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("小朋友管理")).toBeInTheDocument();
  });

  it("renders history page at /history", () => {
    render(
      <MemoryRouter initialEntries={["/history"]}>
        <App />
      </MemoryRouter>,
    );
    // HistoryPage renders header "批改历史"
    expect(screen.getByText("批改历史")).toBeInTheDocument();
    // Phone input appears (may also appear in other components like HomePage
    // due to how React Router renders, so use getAllByText)
    const phoneLabels = screen.getAllByText("请输入家长手机号");
    expect(phoneLabels.length).toBeGreaterThanOrEqual(1);
  });
});
