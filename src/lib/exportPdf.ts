/**
 * Professional PDF export — a REAL .pdf file download (vector text,
 * proper pagination, headers/footers), not a print-dialog workaround.
 * Built client-side with pdfmake (lazy-loaded so the main bundle stays
 * light). The file contains ONLY the result, like a ChatGPT/Claude export.
 */

import type { Content, ContentText, TDocumentDefinitions } from "pdfmake/interfaces";
import { inlineSegments, normalizeMarkdown, slugify } from "./exportDocx";

function spans(line: string): ContentText[] {
  return inlineSegments(line).map((s) => {
    const t: ContentText = { text: s.text };
    if (s.bold) t.bold = true;
    if (s.italic) t.italics = true;
    if (s.code) {
      t.font = "Courier";
      t.fontSize = 8.5;
      t.color = "#1F3864";
    }
    if (s.link) {
      t.color = "#2E74B5";
      t.decoration = "underline";
      t.link = s.link;
    }
    return t;
  });
}

const TABLE_SEP = /^\|?[\s:|-]+\|?[\s:|.-]*$/;

function tableCells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

export function buildPdfContent(md: string): Content[] {
  const out: Content[] = [];
  const lines = normalizeMarkdown(md).replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];

  const flushCode = () => {
    for (const l of codeBuf) {
      out.push({
        text: l || " ",
        font: "Courier",
        fontSize: 8.5,
        color: "#1F3864",
        background: "#F4F4F4",
        margin: [12, 0, 0, 0],
      });
    }
    if (codeBuf.length) out.push({ text: "", margin: [0, 0, 0, 8] });
    codeBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const t = line.trim();

    if (t.startsWith("```")) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        inCode = true;
      }
      i += 1;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }
    if (!t) {
      i += 1;
      continue;
    }
    if (/^---+$/.test(t)) {
      out.push({
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineColor: "#B89600" }],
        margin: [0, 8, 0, 8],
      });
      i += 1;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1]!.length;
      out.push({
        text: spans(h[2]!),
        style: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
        margin: [0, level === 1 ? 14 : 10, 0, 4],
      });
      i += 1;
      continue;
    }
    if (t.startsWith(">")) {
      out.push({
        text: spans(t.replace(/^>\s?/, "")),
        italics: true,
        color: "#444444",
        margin: [12, 0, 0, 6],
      });
      i += 1;
      continue;
    }
    if (t.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1] ?? "") && (lines[i + 1] ?? "").includes("-")) {
      const head = tableCells(t);
      i += 2;
      const body: ContentText[][][] = [
        head.map((c) => [{ text: c, bold: true, fontSize: 9 }]),
      ];
      while (i < lines.length && (lines[i] ?? "").includes("|") && (lines[i] ?? "").trim()) {
        body.push(tableCells(lines[i]!).map((c) => spans(c)));
        i += 1;
      }
      const cols = Math.max(...body.map((r) => r.length));
      out.push({
        style: "table",
        margin: [0, 6, 0, 10],
        table: {
          headerRows: 1,
          widths: Array(cols).fill("*"),
          body: body.map((r) => {
            while (r.length < cols) r.push([{ text: "" }]);
            return r;
          }),
        },
        layout: "lightHorizontalLines",
      });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(t);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(t);
    if (bullet || numbered) {
      const items: ContentText[][] = [];
      const ordered = !bullet;
      while (i < lines.length) {
        const lt = (lines[i] ?? "").trim();
        const m = ordered ? /^\d+[.)]\s+(.*)$/.exec(lt) : /^[-*+]\s+(.*)$/.exec(lt);
        if (!m) break;
        items.push(spans(m[1]!));
        i += 1;
      }
      out.push(
        ordered
          ? { ol: items, margin: [0, 0, 0, 6] }
          : { ul: items, margin: [0, 0, 0, 6] },
      );
      continue;
    }
    out.push({ text: spans(t), style: "body", margin: [0, 0, 0, 6] });
    i += 1;
  }
  flushCode();
  return out;
}

export async function downloadPdfFile(title: string, markdown: string): Promise<void> {
  // Lazy-load: keeps ~1MB of PDF machinery out of the main bundle.
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
    pageMargins: [50, 60, 50, 60],
    info: { title, creator: "GRAVITY Studio" },
    content: [
      { text: title, style: "title", margin: [0, 0, 0, 10] },
      ...buildPdfContent(markdown),
    ],
    styles: {
      title: { fontSize: 22, bold: true, color: "#1F3864" },
      h1: { fontSize: 16, bold: true, color: "#1F3864" },
      h2: { fontSize: 13, bold: true, color: "#2E74B5" },
      h3: { fontSize: 11, bold: true, color: "#2E74B5" },
      body: { fontSize: 10.5, lineHeight: 1.5, color: "#111111" },
      table: { fontSize: 9 },
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
  await pdf.createPdf(def).download(`${slugify(title)}.pdf`);
}
