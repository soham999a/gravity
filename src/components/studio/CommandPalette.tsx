"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Home, Layers, Search, Settings, Sparkles } from "lucide-react";

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
}

interface MissionHit {
  id: string;
  prompt: string;
  status: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [missions, setMissions] = React.useState<MissionHit[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement;
        const typing = target.closest("input, textarea, select");
        if (!typing && !target.closest("[data-no-slash]")) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const raf = requestAnimationFrame(() => {
        setQuery("");
        setActive(0);
        inputRef.current?.focus();
      });
      if (!loaded) {
        fetch("/api/missions", { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((json: { missions?: MissionHit[] } | null) => {
            setMissions(json?.missions ?? []);
            setLoaded(true);
          })
          .catch(() => {});
      }
      return () => {
        cancelAnimationFrame(raf);
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
    return undefined;
  }, [open, loaded]);

  const close = React.useCallback(() => setOpen(false), []);

  const run = React.useCallback(
    (item: PaletteItem) => {
      close();
      item.run();
    },
    [close],
  );

  const goToProjectMemo = React.useCallback(
    (id: string) => {
      router.push(`/projects/${id}`);
    },
    [router],
  );

  const baseActions: PaletteItem[] = React.useMemo(
    () => [
      {
        id: "new-task",
        label: "New task",
        hint: "⌘ Enter",
        icon: <Sparkles className="size-3.5" />,
        run: () => router.push("/?compose=1"),
      },
      {
        id: "home",
        label: "Home",
        hint: "Dashboard",
        icon: <Home className="size-3.5" />,
        run: () => router.push("/"),
      },
      {
        id: "projects",
        label: "Projects",
        hint: "Archive",
        icon: <Layers className="size-3.5" />,
        run: () => router.push("/projects"),
      },
      {
        id: "settings",
        label: "Settings",
        hint: "Account & plan",
        icon: <Settings className="size-3.5" />,
        run: () => router.push("/settings"),
      },
    ],
    [router],
  );

  const q = query.trim().toLowerCase();
  const items: PaletteItem[] = React.useMemo(() => {
    const actionItems = baseActions.filter(
      (a) => !q || a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q),
    );
    const missionItems: PaletteItem[] = missions
      .filter((m) => !q || m.prompt.toLowerCase().includes(q))
      .slice(0, 8)
      .map((m) => ({
        id: m.id,
        label: m.prompt.length > 72 ? `${m.prompt.slice(0, 69)}…` : m.prompt,
        hint: `${m.status} · ${m.id.slice(0, 6)}`,
        icon: <FileText className="size-3.5" />,
        run: () => goToProjectMemo(m.id),
      }));
    return [...actionItems, ...missionItems];
  }, [q, missions, baseActions, goToProjectMemo]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[active];
        if (item) run(item);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, items, active, close, run]);

  if (!open) return null;

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="palette-overlay" onClick={close} />
      <div className="palette-panel">
        <div className="palette-input-row">
          <Search className="palette-search-icon size-4" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Jump to a task, project, or page…"
            className="palette-input"
            aria-label="Search GRAVITY"
          />
          <span className="studio-meta">ESC</span>
        </div>
        <div className="palette-list">
          {items.length === 0 ? (
            <p className="palette-empty">No matches for “{query}”.</p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => run(item)}
                onMouseEnter={() => setActive(index)}
                className={`palette-item ${active === index ? "palette-item-active" : ""}`}
              >
                <span className="palette-item-icon">{item.icon}</span>
                <span className="palette-item-label">{item.label}</span>
                <span className="palette-item-hint">
                  {item.hint}
                  {active === index ? <ArrowRight className="ml-1 inline size-3" /> : null}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="palette-footer">
          <span className="studio-meta">↑ ↓ NAVIGATE · ENTER GO · ESC CLOSE</span>
        </div>
      </div>
    </div>
  );
}