// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BehaviorAnalysisSection from "../BehaviorAnalysisSection";
import { buildDemoLearningPatterns } from "../../../Components/charts/demoData";
import { fetchBehaviorLatest, fetchLearningPatterns } from "../../../services/journalApi";

vi.mock("../../../services/journalApi", () => ({
  fetchBehaviorLatest: vi.fn(), fetchLearningPatterns: vi.fn(), analyzeBehavior: vi.fn(),
}));
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  fetchLearningPatterns.mockResolvedValue(buildDemoLearningPatterns(14));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.clearAllMocks();
});
async function render() {
  await act(async () => root.render(<BehaviorAnalysisSection userId="student-a" demoMode={false} />));
}
it("shows the persisted AI failure rather than a first-analysis message", async () => {
  fetchBehaviorLatest.mockResolvedValue({ available: false, status: "failed", error: "Analysis could not be completed. Please try again." });
  await render();
  expect(host.textContent).toContain("Analysis could not be completed");
  expect(host.textContent).not.toContain("Your first analysis appears");
});
it("shows that changed journals require updated feedback", async () => {
  fetchBehaviorLatest.mockResolvedValue({ available: false, status: "stale" });
  await render();
  expect(host.textContent).toContain("Your journal has changed");
});
it("distinguishes an initial API failure from missing analysis", async () => {
  fetchBehaviorLatest.mockRejectedValue(new Error("Connection failed"));
  await render();
  expect(host.textContent).toContain("Your analysis could not be loaded");
});
