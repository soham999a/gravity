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
