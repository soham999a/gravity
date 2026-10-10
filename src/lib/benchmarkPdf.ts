/**
 * Investor slide PDF — the spec §investor deck table as a real .pdf download.
 * Built ONLY from measured aggregates (same data the slide table renders);
 * unmeasured cells print "—", never 0. Lazy-loaded pdfmake like exportPdf.
 */

import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { slugify } from "./exportDocx";

export interface SlideSystem {
  system: string;
  track: string;
  success: string;
  costPS: string;
  latency: string;
  tokens: string;
  resEff: string;
  verify: string;
  decEff: string;
  points: string;
}

export interface SlideInput {
  runId: string;
  seed: number;
  taskVersion?: string;
  recordCount: number;
  startedAt: string;
  heroCost: string;
  heroCostSystem: string;
  systems: SlideSystem[];
}

function slideRows(systems: SlideSystem[]): Content {
  const head = [{ text: "BENCHMARK", bold: true }, ...systems.map((s) => ({ text: s.system, bold: true }))];
  const row = (label: string, pick: (s: SlideSystem) => string, hero = false): TableCell[] => [
    hero ? { text: label, bold: true, color: "#8A6F09" } : label,
    ...systems.map((s) => (hero ? { text: pick(s), bold: true, color: "#8A6F09" } : pick(s))),
  ];
  return {
    table: {
      headerRows: 1,
      widths: ["auto", ...systems.map(() => "*")],
      body: [
        head,
        row("Task Success", (s) => s.success),
        row("Cost / Successful Task", (s) => s.costPS, true),
        row("P50 Latency", (s) => s.latency),
        row("Tokens / Task", (s) => s.tokens),
        row("Resource Efficiency", (s) => s.resEff),
        row("Verification Reliability", (s) => s.verify),
        row("Decision Efficiency", (s) => s.decEff, true),
        row("Points", (s) => s.points),
      ],
    },
    fontSize: 9,
    layout: "lightHorizontalLines",
    margin: [0, 8, 0, 0],
  };
}

export async function downloadSlidePdf(input: SlideInput): Promise<void> {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfMake = (pdfMakeModule as unknown as { default?: unknown }).default ?? pdfMakeModule;
  const vfsModule = await import("pdfmake/build/vfs_fonts");
  const vfs = (vfsModule as unknown as { default?: unknown }).default ?? vfsModule;
  const pdf = pdfMake as {
    vfs: unknown;
    createPdf: (def: TDocumentDefinitions) => { download: (name: string) => void };
  };
  pdf.vfs = { ...(vfs as Record<string, string>) };

  const def: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: input.systems.length > 4 ? "landscape" : "portrait",
    pageMargins: [44, 56, 44, 56],
    info: { title: `GRAVITY Benchmark ${input.runId}`, creator: "GRAVITY Studio" },
    content: [
      { text: "GRAVITY BENCHMARK — INVESTOR SLIDE", style: "title", margin: [0, 0, 0, 4] },
      {
        text: "Why spend frontier-level intelligence when lower-cost computation is sufficient? Same task · same input · same criterion — measured evidence only.",
        fontSize: 9.5,
        italics: true,
        color: "#555555",
        margin: [0, 0, 0, 6],
      },
      {
        text: `Run ${input.runId} · seed ${input.seed} · tasks ${input.taskVersion ?? "—"} · ${input.recordCount} records · ${input.startedAt}`,
        fontSize: 8,
        color: "#888888",
        margin: [0, 0, 0, 4],
      },
      {
        text: `COST PER SUCCESSFUL OUTCOME — ${input.heroCostSystem}: ${input.heroCost}`,
        fontSize: 12,
        bold: true,
        color: "#8A6F09",
        margin: [0, 0, 0, 2],
      },
      slideRows(input.systems),
      {
        text: "Every cell traces to measured BenchmarkRecords. Unmeasured cells show —, never 0.",
        fontSize: 8,
        color: "#888888",
        margin: [0, 8, 0, 0],
      },
    ],
    styles: {
      title: { fontSize: 18, bold: true, color: "#1F3864" },
    },
    defaultStyle: { font: "Roboto" },
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#888888",
      margin: [0, 10, 0, 0],
    }),
  };
  await pdf.createPdf(def).download(`gravity-benchmark-slide-${slugify(input.runId).slice(0, 40)}.pdf`);
}
