/* @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import BarChart from "../BarChart";
import Histogram from "../Histogram";
import LineAreaChart from "../LineAreaChart";
import CalendarHeatmap from "../CalendarHeatmap";
import ScatterPlot from "../ScatterPlot";
import DonutChart from "../DonutChart";
import Sparkline from "../Sparkline";
import RadialGauge from "../RadialGauge";
import ProgressBar from "../ProgressBar";
import ChartCard from "../ChartCard";
import ChartTooltip from "../ChartTooltip";
import HowCalculatedPopover from "../HowCalculatedPopover";
import DownloadPngButton from "../DownloadPngButton";

let container;

function renderToContainer(element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return container;
}

afterEach(() => {
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
});

const FIXED_BAR = { categories: ["Mon", "Tue", "Wed"], series: [{ key: "a", label: "A", color: "#7c3aed", values: [1, 2, 3] }] };
const EMPTY_BAR = { categories: [], series: [] };
const CONSTANT_BAR = { categories: ["Mon", "Tue", "Wed"], series: [{ key: "a", label: "A", color: "#7c3aed", values: [0, 0, 0] }] };

describe("chart components render without throwing", () => {
  it("BarChart - fixed, empty, constant data", () => {
    expect(() => renderToContainer(<BarChart {...FIXED_BAR} />)).not.toThrow();
    expect(() => renderToContainer(<BarChart {...EMPTY_BAR} />)).not.toThrow();
    expect(() => renderToContainer(<BarChart {...CONSTANT_BAR} />)).not.toThrow();
  });

  it("Histogram - with bins, with raw values, empty", () => {
    expect(() => renderToContainer(<Histogram bins={{ labels: ["0-30"], counts: [2] }} />)).not.toThrow();
    expect(() => renderToContainer(<Histogram values={[10, 20, 400]} />)).not.toThrow();
    const el = renderToContainer(<Histogram values={[0, 0, 0]} />);
    expect(el.textContent).toMatch(/not recorded/i);
  });

  it("LineAreaChart - fixed, too-short, constant", () => {
    const series = [
      { date: "2026-01-01", value: 10 },
      { date: "2026-01-02", value: 20 },
      { date: "2026-01-03", value: 15 },
    ];
    expect(() => renderToContainer(<LineAreaChart series={series} />)).not.toThrow();
    const empty = renderToContainer(<LineAreaChart series={[]} />);
    expect(empty.textContent).toMatch(/not enough data/i);
    expect(() =>
      renderToContainer(<LineAreaChart series={[{ date: "a", value: 0 }, { date: "b", value: 0 }]} />)
    ).not.toThrow();
  });

  it("CalendarHeatmap - fixed and empty", () => {
    expect(() => renderToContainer(<CalendarHeatmap cells={[{ date: "2026-01-05", status: "on_time" }]} />)).not.toThrow();
    const empty = renderToContainer(<CalendarHeatmap cells={[]} />);
    expect(empty.textContent).toMatch(/no calendar data/i);
  });

  it("ScatterPlot - fixed and empty", () => {
    expect(() => renderToContainer(<ScatterPlot points={[{ x: 1, y: 2 }, { x: 2, y: 4 }]} />)).not.toThrow();
    const empty = renderToContainer(<ScatterPlot points={[]} />);
    expect(empty).toBeTruthy();
  });

  it("DonutChart - fixed, empty, single-segment", () => {
    expect(() =>
      renderToContainer(<DonutChart segments={[{ label: "A", value: 3 }, { label: "B", value: 1 }]} />)
    ).not.toThrow();
    const empty = renderToContainer(<DonutChart segments={[]} />);
    expect(empty.textContent).toMatch(/no data/i);
    expect(() => renderToContainer(<DonutChart segments={[{ label: "A", value: 5 }]} />)).not.toThrow();
  });

  it("Sparkline - fixed and too-short", () => {
    expect(() => renderToContainer(<Sparkline values={[1, 2, 3, 2]} />)).not.toThrow();
    expect(() => renderToContainer(<Sparkline values={[1]} />)).not.toThrow();
  });

  it("RadialGauge - fixed and zero", () => {
    expect(() => renderToContainer(<RadialGauge value={5} max={10} />)).not.toThrow();
    expect(() => renderToContainer(<RadialGauge value={0} max={0} />)).not.toThrow();
  });

  it("ProgressBar - fixed and zero", () => {
    expect(() => renderToContainer(<ProgressBar label="x" fraction={0.5} />)).not.toThrow();
    expect(() => renderToContainer(<ProgressBar label="x" fraction={0} />)).not.toThrow();
  });

  it("ChartCard - with children, loading, empty state", () => {
    expect(() =>
      renderToContainer(
        <ChartCard title="Test">
          <div>content</div>
        </ChartCard>
      )
    ).not.toThrow();
    expect(() => renderToContainer(<ChartCard title="Test" loading />)).not.toThrow();
    expect(() => renderToContainer(<ChartCard title="Test" emptyState={<div>empty</div>} />)).not.toThrow();
  });

  it("ChartTooltip - visible and hidden", () => {
    expect(() => renderToContainer(<ChartTooltip visible>content</ChartTooltip>)).not.toThrow();
    expect(() => renderToContainer(<ChartTooltip visible={false}>content</ChartTooltip>)).not.toThrow();
  });

  it("HowCalculatedPopover renders", () => {
    expect(() => renderToContainer(<HowCalculatedPopover>explanation</HowCalculatedPopover>)).not.toThrow();
  });

  it("DownloadPngButton renders without a target SVG present", () => {
    const ref = { current: document.createElement("div") };
    expect(() => renderToContainer(<DownloadPngButton targetRef={ref} />)).not.toThrow();
  });
});
