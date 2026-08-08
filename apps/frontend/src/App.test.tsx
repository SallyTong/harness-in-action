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

  it("renders placeholder at /history", () => {
    render(
      <MemoryRouter initialEntries={["/history"]}>
        <App />
      </MemoryRouter>,
    );
    const items = screen.getAllByText(/即将推出/);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
