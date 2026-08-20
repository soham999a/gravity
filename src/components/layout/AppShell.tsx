"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  GitBranch,
  ScanSearch,
  ArrowDownToLine,
  Boxes,
  Bot,
  Cpu,
  Wrench,
  Workflow,
  BookOpen,
  BarChart3,
  DollarSign,
  Grid3X3,
  Layers,
  Settings,
  Menu,
  X,
  Circle,
  ArrowUp,
  BrainCircuit,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={16} />, section: "Platform" },
  { label: "Gravity Control", href: "/", icon: <Zap size={16} />, section: "Platform" },
  { label: "Missions", href: "/missions", icon: <Boxes size={16} />, section: "Platform" },
  { label: "Intelligence Router", href: "/router", icon: <GitBranch size={16} />, section: "Intelligence" },
  { label: "Problem Profiler", href: "/profiler", icon: <ScanSearch size={16} />, section: "Intelligence" },
  { label: "Escalation Ladder", href: "/escalation", icon: <ArrowUp size={16} />, section: "Intelligence" },
  { label: "Value of Intelligence", href: "/voi", icon: <BrainCircuit size={16} />, section: "Intelligence" },
  { label: "Compression", href: "/compression", icon: <ArrowDownToLine size={16} />, section: "Intelligence" },
  { label: "Execution Canvas", href: "/execution", icon: <Workflow size={16} />, section: "Intelligence" },
  { label: "Agent Registry", href: "/agents", icon: <Bot size={16} />, section: "Registry" },
  { label: "Model Registry", href: "/models", icon: <Cpu size={16} />, section: "Registry" },
  { label: "Tool Fabric", href: "/tools", icon: <Wrench size={16} />, section: "Registry" },
  { label: "Workflows", href: "/workflows", icon: <GitBranch size={16} />, section: "Registry" },
  { label: "Decision Ledger", href: "/ledger", icon: <BookOpen size={16} />, section: "Observability" },
  { label: "Evaluation", href: "/evaluation", icon: <BarChart3 size={16} />, section: "Observability" },
  { label: "Intelligence Economy", href: "/cost", icon: <DollarSign size={16} />, section: "Observability" },
  { label: "Portfolio", href: "/portfolio", icon: <Grid3X3 size={16} />, section: "Platform" },
  { label: "Architecture", href: "/architecture", icon: <Layers size={16} />, section: "Platform" },
  { label: "Settings", href: "/settings", icon: <Settings size={16} />, section: "Admin" },
];

const sections = ["Platform", "Intelligence", "Registry", "Observability", "Admin"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[248px] flex-col fixed inset-y-0 left-0 border-r border-border bg-deep z-50">
        {/* Brand */}
        <div className="h-14 flex items-center px-5 border-b border-border">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.2em] text-gold">MATRIX</span>
            <div className="w-px h-4 bg-border-light" />
            <span className="font-serif text-sm text-ivory italic">GRAVITY</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {sections.map((section) => {
            const items = navItems.filter((i) => i.section === section);
            return (
              <div key={section} className="mb-4">
                <div className="kicker px-3 mb-2">{section}</div>
                {items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-xs transition-colors rounded-none",
                        active
                          ? "text-gold bg-gold-pale"
                          : "text-ivory-faint hover:text-ivory hover:bg-surface"
                      )}
                    >
                      <span className="opacity-70">{item.icon}</span>
                      <span className="font-light">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 border border-gold/30 font-mono text-[7px] tracking-[0.1em] uppercase text-gold bg-gold-pale">
              Demo Mode
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Circle size={6} className="text-success-text fill-success-text" />
            <span className="font-mono text-[8px] tracking-[0.15em] uppercase text-ivory-faint">
              System Operational
            </span>
          </div>
          <div className="font-mono text-[8px] tracking-[0.12em] text-ivory-faint mt-1 opacity-60">
            v0.1.0 — GRAVITY Platform
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 border-b border-border bg-deep/97 backdrop-blur-md z-50 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-gold">MATRIX</span>
          <span className="font-serif text-sm text-ivory italic">GRAVITY</span>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-ivory-faint">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-void/95 pt-14 overflow-y-auto">
          <nav className="p-4">
            {navItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-border",
                    active ? "text-gold" : "text-ivory-faint"
                  )}
                >
                  <span className="opacity-70">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-[248px] pt-14 lg:pt-0 min-h-screen">
        {/* Demo Mode Banner */}
        <div className="bg-gold/10 border-b border-gold/20 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-gold">
              Demo Mode — Interactive Prototype
            </span>
          </div>
          <span className="font-mono text-[8px] tracking-[0.12em] text-ivory-faint">
            MATRIX · GRAVITY Platform · Aug 2026
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
