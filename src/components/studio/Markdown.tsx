"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function linkifyBareUrls(text: string): string {
  return text.replace(
    /(?<![\w\]\)])(https?:\/\/[^\s<>\x22]+[^\s<>\x22.,;\:)!?])(?![\w])/gi,
    (match) => `[${match}](${match})`,
  );
}

function codeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(codeText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return codeText(node.props.children);
  return "";
}

/** Code block with a giant-grade copy button (copies raw code, not HTML). */
function PreWithCopy({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codeText(children));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard denied — no-op */
    }
  };
  return (
    <div className="md-codeblock">
      <button type="button" onClick={copy} className="md-copy" aria-label="Copy code">
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "COPIED" : "COPY"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  const source = linkifyBareUrls(children);
  return (
    <div className="studio-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: PreWithCopy }}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
