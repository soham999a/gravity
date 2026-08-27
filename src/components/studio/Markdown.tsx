"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function linkifyBareUrls(text: string): string {
  return text.replace(
    /(?<![\w\]\)])(https?:\/\/[^\s<>\x22]+[^\s<>\x22.,;\:)!?])(?![\w])/gi,
    (match) => `[${match}](${match})`,
  );
}

export function Markdown({ children }: { children: string }) {
  const source = linkifyBareUrls(children);
  return (
    <div className="studio-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}