import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest runs without `globals`, so @testing-library/react's auto-cleanup does
// not register. Unmount rendered trees between tests so queries don't match
// stale components from a previous test.
afterEach(cleanup);
