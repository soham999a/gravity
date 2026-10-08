/**
 * Professional .docx export — genuine OOXML (not the legacy HTML-payload
 * .doc). Built on the `docx` library in the browser: real Heading styles
 * (Navigation Pane + TOC work), true Word list numbering, header-row
 * tables, A4 portrait section, footer with page numbers.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { downloadBlob } from "./utils";

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "gravity-result"
  );
}

/**
 * Normalize sloppy model markdown so exports look professional even when the
 * model skips spaces: "1.Name" → "1. Name" (unless the rest starts with a
 * digit, guarding decimals like "3.5"), unicode bullets "•" → "-".
 */
export function normalizeMarkdown(md: string): string {
  return md
    .replace(/^(\d{1,2}[.)])(?=[^\d\s])/gm, "$1 ")
    .replace(/^[•·▪◦]\s*/gm, "- ");
}

/**
 * The file's title comes from the CONTENT (first heading), not the raw user
 * prompt ("make me a word file of top 20 mountains" must not be the H1).
 * Falls back to a cleaned prompt with request verbs stripped.
 */
export function resolveDocTitle(promptTitle: string, markdown: string): string {
  const h = /^(#{1,3})\s+(.+)$/m.exec(markdown);
  if (h?.[2]) {
    const cleaned = h[2]
      .replace(/\*+/g, "")
      .replace(/`+/g, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (cleaned.length > 2) return cleaned.slice(0, 120);
  }
  const t = promptTitle
    .replace(
      /^(please\s+)?(make|give|generate|write|create|produce|show)\s+(me\s+)?(a\s+)?(word\s+file|pdf\s+file|word|pdf|file|docx?|document|list|report)\s+(of\s+|about\s+|on\s+)?/i,
      "",
    )
    .replace(/\s+(in\s+a\s+)?(word|pdf|docx?|file|format)\s*$/i, "")
    .trim();
  if (!t) return "GRAVITY Result";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ------------------------------------------------------------------ */
/* Inline markdown → TextRun segments                                 */
/* ------------------------------------------------------------------ */

interface Segment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
}

/** Tokenizes **bold**, *italic*, `code`, [text](url) within one line. */
export function inlineSegments(line: string): Segment[] {
  const segs: Segment[] = [];
  // link | bold | italic | code — order matters (links first so inner
  // formatting inside link text is kept plain, like Word would).
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|(^|\W)\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const idx = m[0].startsWith("*") && m[5] ? m.index + m[5].length : m.index;
    if (idx > last) segs.push({ text: line.slice(last, idx) });
    if (m[1] !== undefined) {
      segs.push({ text: m[1], link: m[2] });
    } else if (m[3] !== undefined) {
      segs.push({ text: m[3], bold: true });
    } else if (m[4] !== undefined) {
      segs.push({ text: m[4], code: true });
    } else if (m[6] !== undefined) {
      segs.push({ text: m[6], italic: true });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) segs.push({ text: line.slice(last) });
  return segs.length > 0 ? segs : [{ text: line }];
}

function runsFor(segs: Segment[], base?: { size?: number; color?: string }): (TextRun | ExternalHyperlink)[] {
  return segs.map((s) => {
    const run = new TextRun({
      text: s.text,
      bold: s.bold,
      italics: s.italic,
      font: s.code ? "Consolas" : undefined,
      size: s.code ? 19 : (base?.size ?? 22),
      color: s.link ? "2E74B5" : (s.code ? "1F3864" : base?.color),
      underline: s.link ? {} : undefined,
    });
    return s.link ? new ExternalHyperlink({ link: s.link, children: [run] }) : run;
  });
}

function bodyPara(line: string): Paragraph {
  return new Paragraph({
    children: runsFor(inlineSegments(line)),
    spacing: { after: 120 },
  });
}

/* ------------------------------------------------------------------ */
/* Block parser: markdown → docx children                              */
/* ------------------------------------------------------------------ */

const TABLE_SEP = /^\|?[\s:|-]+\|?[\s:|.-]*$/;

function tableCells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function buildTable(head: string[], body: string[][]): Table {
  const cell = (text: string, header: boolean) =>
    new TableCell({
      children: [
        new Paragraph({
          children: runsFor(inlineSegments(text), { size: 20 }),
          spacing: { after: 0 },
        }),
      ],
      shading: header ? { fill: "D9E2F3", type: ShadingType.CLEAR } : undefined,
      verticalAlign: header ? undefined : undefined,
    });
  return new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: head.map((h) => cell(h, true)),
        tableHeader: true,
      }),
      ...body.map(
        (r) =>
          new TableRow({
            children: r.map((c) => cell(c, false)),
          }),
      ),
    ],
  });
}

export function markdownToDocxChildren(md: string): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  // Lenient input: normalize first so "1.Name" and "• item" become real lists.
  const lines = normalizeMarkdown(md).replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];

  const flushCode = () => {
    for (const l of codeBuf) {
      out.push(
        new Paragraph({
          children: [new TextRun({ text: l || " ", font: "Consolas", size: 19, color: "1F3864" })],
          spacing: { after: 0 },
          indent: { left: 360 },
        }),
      );
    }
    if (codeBuf.length) out.push(new Paragraph({ children: [], spacing: { after: 160 } }));
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
      out.push(
        new Paragraph({
          children: [],
          spacing: { before: 160, after: 160 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "B89600" } },
        }),
      );
      i += 1;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1]!.length;
      out.push(
        new Paragraph({
          heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          children: runsFor(inlineSegments(h[2]!)),
          spacing: { before: 240, after: 120 },
        }),
      );
      i += 1;
      continue;
    }
    if (t.startsWith(">")) {
      out.push(
        new Paragraph({
          children: runsFor(inlineSegments(t.replace(/^>\s?/, "")), { color: "404040", size: 21 }),
          spacing: { after: 120 },
          indent: { left: 720 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "2E74B5" } },
        }),
      );
      i += 1;
      continue;
    }
    if (t.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1] ?? "") && (lines[i + 1] ?? "").includes("-")) {
      const head = tableCells(t);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").includes("|") && (lines[i] ?? "").trim()) {
        body.push(tableCells(lines[i]!));
        i += 1;
      }
      out.push(buildTable(head, body));
      out.push(new Paragraph({ children: [], spacing: { after: 160 } }));
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(t);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(t);
    if (bullet || numbered) {
      const numberedList = !bullet;
      while (i < lines.length) {
        const lt = (lines[i] ?? "").trim();
        const bm = numberedList ? /^\d+[.)]\s+(.*)$/.exec(lt) : /^[-*+]\s+(.*)$/.exec(lt);
        if (!bm) break;
        out.push(
          new Paragraph({
            numbering: { reference: numberedList ? "gravity-numbered" : "gravity-bullets", level: 0 },
            children: runsFor(inlineSegments(bm[1]!)),
            spacing: { after: 60 },
          }),
        );
        i += 1;
      }
      continue;
    }
    out.push(bodyPara(t));
    i += 1;
  }
  flushCode();
  return out;
}

/* ------------------------------------------------------------------ */
/* Document assembly + download                                        */
/* ------------------------------------------------------------------ */

/**
 * The file contains ONLY the result: content-derived title + body.
 * No metric tables, no boilerplate — like a ChatGPT/Claude export.
 */
export async function downloadDocxFile(title: string, markdown: string): Promise<void> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)], spacing: { after: 160 } }),
    ...markdownToDocxChildren(markdown),
  ];

  const doc = new Document({
    creator: "GRAVITY Studio",
    title,
    numbering: {
      config: [
        {
          reference: "gravity-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "gravity-numbered",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", size: 18, color: "808080" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" }),
                  new TextRun({ text: " of ", size: 18, color: "808080" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "808080" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${slugify(title)}.docx`);
}
