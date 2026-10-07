import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fire-and-forget mission-execute kick with bounded retry: in dev, a Fast
 * Refresh or cold Turbopack compile can transiently 404 a route that
 * provably exists; one retry after a beat makes that survivable instead of
 * leaving a mission stuck in "pending" forever (execute is fire-and-forget
 * and nothing else ever re-triggers it).
 */
export function kickExecute(missionId: string, attempts = 2): void {
  fetch(`/api/missions/${missionId}/execute`, { method: "POST", credentials: "include" })
    .then((res) => {
      if (!res.ok && res.status >= 500 && attempts > 0) {
        setTimeout(() => kickExecute(missionId, attempts - 1), 1_200);
      }
    })
    .catch(() => {
      if (attempts > 0) setTimeout(() => kickExecute(missionId, attempts - 1), 1_200);
    });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Download an image URL to disk. Works for data-URLs and CORS-open hosts;
 * falls back to opening full-size when the bytes can't be fetched.
 */
export async function downloadImageFile(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    downloadBlob(await res.blob(), filename);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

/**
 * Minimal markdown → Word-friendly HTML (headings, bold/italic/code/links,
 * bullets, numbered lists, tables, quotes, rules, code fences). Covers what
 * GRAVITY results actually contain — not a full spec parser by design.
 */
export function markdownToWordHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];
  const flushCode = () => {
    if (codeBuf.length) out.push(`<pre>${esc(codeBuf.join("\n"))}</pre>`);
    codeBuf = [];
  };

  const isTableSep = (s: string) => /^\|?[\s:|-]+\|?[\s:|.-]*$/.test(s.trim()) && s.includes("-");
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
      out.push("<hr/>");
      i += 1;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1]!.length;
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`);
      i += 1;
      continue;
    }
    if (t.startsWith(">")) {
      out.push(`<blockquote>${inline(t.replace(/^>\s?/, ""))}</blockquote>`);
      i += 1;
      continue;
    }
    // Table: header row + separator row + body rows.
    if (t.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1] ?? "")) {
      const cells = (r: string) =>
        r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      const head = cells(t);
      out.push("<table><tr>" + head.map((c) => `<th>${c}</th>`).join("") + "</tr>");
      i += 2;
      while (i < lines.length && (lines[i] ?? "").includes("|") && (lines[i] ?? "").trim()) {
        out.push("<tr>" + cells(lines[i]!).map((c) => `<td>${c}</td>`).join("") + "</tr>");
        i += 1;
      }
      out.push("</table>");
      continue;
    }
    // Lists: consecutive -/* or 1. lines group into one list.
    const bullet = /^[-*]\s+(.*)$/.exec(t);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(t);
    if (bullet || numbered) {
      const tag = bullet ? "ul" : "ol";
      out.push(`<${tag}>`);
      while (i < lines.length) {
        const lt = (lines[i] ?? "").trim();
        const m = tag === "ul" ? /^[-*]\s+(.*)$/.exec(lt) : /^\d+[.)]\s+(.*)$/.exec(lt);
        if (!m) break;
        out.push(`<li>${inline(m[1]!)}</li>`);
        i += 1;
      }
      out.push(`</${tag}>`);
      continue;
    }
    out.push(`<p>${inline(t)}</p>`);
    i += 1;
  }
  flushCode();
  return out.join("\n");
}

/**
 * PDF via the browser's own print-to-PDF (no dependency, no server round-trip).
 * Opens a clean A4 print view — user picks "Save as PDF". Paged-media CSS
 * keeps headings with their content, tables/figures unbroken, headers
 * repeated, and page numbers in the footer.
 */
export function printPdfFile(title: string, markdown: string): void {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    window.alert("Popup blocked — allow popups to export PDF.");
    return;
  }
  win.document.write(
    `<html><head><meta charset="utf-8"><title>${esc(title)}</title>` +
      `<style>` +
      `@page{size:A4 portrait;margin:18mm 16mm 20mm;` +
      `@bottom-center{content:"GRAVITY  ·  Page " counter(page) " of " counter(pages);font-size:8.5pt;color:#888;font-family:Georgia,serif;}}` +
      `html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}` +
      `body{font-family:Georgia,Calibri,Arial,serif;max-width:700px;margin:40px auto;padding:0 20px;color:#111;line-height:1.65;font-size:11pt;}` +
      `.doc-kicker{font-family:Arial,sans-serif;font-size:8.5pt;letter-spacing:.22em;text-transform:uppercase;color:#B89600;margin:0 0 6px;}` +
      `h1{font-size:24pt;line-height:1.2;margin:0 0 4px;color:#1F3864;}` +
      `.doc-sub{font-size:9.5pt;color:#666;font-style:italic;margin:0 0 18px;}` +
      `h2{font-size:15pt;color:#1F3864;break-after:avoid;margin:20px 0 6px;}` +
      `h3{font-size:12pt;color:#2E74B5;break-after:avoid;margin:16px 0 4px;}` +
      `p{margin:0 0 8px;}` +
      `table{border-collapse:collapse;margin:12px 0;width:100%;break-inside:avoid;}` +
      `thead{display:table-header-group;}` +
      `th,td{border:1px solid #999;padding:6px 10px;text-align:left;font-size:9.5pt;}` +
      `th{background:#D9E2F3 !important;}` +
      `tr{break-inside:avoid;}` +
      `blockquote{border-left:3px solid #2E74B5;margin:12px 0;padding:4px 14px;color:#333;break-inside:avoid;}` +
      `pre{background:#f4f4f4 !important;padding:10px;overflow-x:auto;break-inside:avoid;font-size:9pt;}` +
      `code{font-family:Consolas,monospace;font-size:9pt;}` +
      `ul,ol{margin:0 0 8px 20px;padding:0;}` +
      `li{margin-bottom:3px;}` +
      `figure,.callout{break-inside:avoid;}` +
      `a{color:#2E74B5;text-decoration:none;}` +
      `@media print{body{margin:0;max-width:none;}}` +
      `</style></head><body>` +
      `<p class="doc-kicker">Gravity / Result</p>` +
      `<h1>${esc(title)}</h1><p class="doc-sub">Generated by GRAVITY Studio</p>${markdownToWordHtml(markdown)}</body></html>`,
  );
  win.document.close();
  win.focus();
  // Let the document settle before invoking the print dialog.
  setTimeout(() => win.print(), 400);
}

export function money(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount < 1 ? 3 : 2,
    maximumFractionDigits: amount < 1 ? 3 : 2,
  }).format(amount);
}

export function dur(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
