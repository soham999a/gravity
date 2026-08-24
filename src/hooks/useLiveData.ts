"use client";

import * as React from "react";

export function useLiveData<T = unknown>(
  endpoint: string,
  pollMs?: number,
): { data: T[] | null; live: boolean } {
  const [data, setData] = React.useState<T[] | null>(null);
  const [live, setLive] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json?.live && Array.isArray(json.items)) {
          setData(json.items);
          setLive(true);
        }
      } catch {
        /* keep fallback */
      }
      if (!cancelled && pollMs) timer = setTimeout(load, pollMs);
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [endpoint, pollMs]);

  return { data, live };
}
