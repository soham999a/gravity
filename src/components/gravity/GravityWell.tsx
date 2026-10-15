"use client";

import * as React from "react";

/**
 * GravityWell — spacetime bent around a decision.
 *
 * A faint polar grid (rings + spokes) funnels toward a slow-orbiting mass
 * while gold glints travel Kepler-style orbits — inner fast, outer slow.
 * Your pointer becomes a second, gentler mass: the well leans toward it.
 * The concept IS the brand: intelligence has gravity, paths bend toward
 * the sufficient answer. Landing-only, ultra-subtle, DPR-aware, pauses
 * off-tab, frozen frame under reduced-motion.
 */

interface Orbiter {
  r: number; // orbit radius px
  a: number; // angle
  speed: number; // rad per ms
  size: number;
  alpha: number;
  wobble: number;
  plunging: boolean;
}

interface Ring {
  r: number;
  alpha: number;
}

export function GravityWell() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let rafId = 0;

    // Well center rests below the hero; pointer leans it gently.
    let cx = 0;
    let cy = 0;
    let tx = 0;
    let ty = 0;
    const pointer = { x: -9999, y: -9999 };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width / 2;
      cy = height * 0.66;
      tx = cx;
      ty = cy;
    };
    resize();
    window.addEventListener("resize", resize);

    const RINGS = 9;
    const SPOKES = 24;
    const SIGMA = () => Math.min(width, height) * 0.16;
    const DEPTH = () => Math.min(width, height) * 0.075;

    const small = width < 640;
    const maxOrbit = Math.min(width, height) * 0.5;
    const orbiters: Orbiter[] = Array.from({ length: small ? 12 : 22 }, (_, i) => {
      const r = (0.1 + (i / (small ? 12 : 22)) * 0.75) * maxOrbit;
      return {
        r,
        a: Math.random() * Math.PI * 2,
        // Kepler-ish: inner orbits sweep faster.
        speed: (0.00012 / Math.sqrt(Math.max(0.2, r / 200))) * (i % 2 === 0 ? 1 : -0.6),
        size: i % 5 === 0 ? 1.8 : 1.2,
        alpha: i % 5 === 0 ? 0.75 : 0.4,
        wobble: Math.random() * Math.PI * 2,
        plunging: false,
      };
    });
    // Expanding commitment rings + the decision flash.
    const rings: Ring[] = [];
    let flash = 0;
    let lastPlunge = performance.now();

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    // Funnel displacement: points sink toward the well, gaussian falloff.
    const sink = (d: number) => {
      const s = SIGMA();
      const e = -(d * d) / (2 * s * s);
      return DEPTH() * Math.exp(e > -12 ? e : -12);
    };

    const paint = (t: number) => {
      ctx.clearRect(0, 0, width, height);

      // Ease the well toward rest, leaning at the pointer.
      const lean = 0.035;
      const gx = width / 2 + (pointer.x - width / 2) * 0.12;
      const gy = height * 0.66 + (pointer.y - height * 0.66) * 0.12;
      tx += ((pointer.x > -1000 ? gx : width / 2) - tx) * lean;
      ty += ((pointer.y > -1000 ? gy : height * 0.66) - ty) * lean;
      cx += (tx - cx) * lean;
      cy += (ty - cy) * lean;

      const maxR = Math.hypot(width, height) / 2;
      const rot = t * 0.00002;

      // Rings — bent downward around the mass.
      for (let ring = 1; ring <= RINGS; ring += 1) {
        const r = (ring / RINGS) * maxR;
        const fade = 1 - ring / (RINGS + 1);
        ctx.beginPath();
        const steps = 90;
        for (let s = 0; s <= steps; s += 1) {
          const a = (s / steps) * Math.PI * 2;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 0.62 - sink(r) * 0.9;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(184, 150, 12, ${(0.05 + fade * 0.1).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Spokes — slow rotation, dipped by the funnel.
      for (let s = 0; s < SPOKES; s += 1) {
        const a = rot + (s / SPOKES) * Math.PI * 2;
        ctx.beginPath();
        const steps = 40;
        for (let i = 0; i <= steps; i += 1) {
          const r = (i / steps) * maxR;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 0.62 - sink(r) * 0.9;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(184, 150, 12, 0.045)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Commitment scheduler — every 7–12s one outer orbiter locks in:
      // spirals down, flashes the well, rings outward, reborn outside.
      const plungingNow = orbiters.some((o) => o.plunging);
      if (!plungingNow && t - lastPlunge > 7000 + Math.random() * 5000) {
        const candidates = orbiters.filter((o) => o.r > maxOrbit * 0.35);
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        if (chosen) {
          chosen.plunging = true;
          lastPlunge = t;
        }
      }

      // The mass — a quiet gold heart, breathing.
      const breathe = 3 + Math.sin(t * 0.0012) * 0.8;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
      core.addColorStop(0, "rgba(233, 196, 99, 0.5)");
      core.addColorStop(1, "rgba(233, 196, 99, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, breathe, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(184, 150, 12, 0.8)";
      ctx.fill();

      // Decision flash + expanding commitment rings.
      if (flash > 0.01) {
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
        fg.addColorStop(0, `rgba(233, 196, 99, ${(flash * 0.4).toFixed(3)})`);
        fg.addColorStop(1, "rgba(233, 196, 99, 0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(cx, cy, 90, 0, Math.PI * 2);
        ctx.fill();
        flash *= 0.93;
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const ring = rings[i]!;
        ring.r += 2.6;
        ring.alpha *= 0.94;
        if (ring.alpha < 0.02) {
          rings.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(216, 190, 90, ${ring.alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Orbiters with fading trails — plunging ones burn bright and fall in.
      ctx.lineCap = "round";
      for (const o of orbiters) {
        if (o.plunging) {
          o.a += Math.abs(o.speed) * 3.2 * 16;
          o.r *= 0.955;
          if (o.r < 13) {
            o.plunging = false;
            o.r = maxOrbit * (0.78 + Math.random() * 0.12);
            o.a = Math.random() * Math.PI * 2;
            flash = 1;
            rings.push({ r: 12, alpha: 0.5 });
          }
        } else {
          o.a += o.speed * 16;
        }
        const wob = Math.sin(t * 0.0006 + o.wobble) * 3;
        const x = cx + Math.cos(o.a) * o.r;
        const y = cy + Math.sin(o.a) * o.r * 0.62 - sink(o.r) * 0.9 + wob;
        const px = cx + Math.cos(o.a - o.speed * 90) * o.r;
        const py = cy + Math.sin(o.a - o.speed * 90) * o.r * 0.62 - sink(o.r) * 0.9 + wob;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.strokeStyle = o.plunging
          ? "rgba(233, 196, 99, 0.95)"
          : `rgba(216, 190, 90, ${o.alpha.toFixed(2)})`;
        ctx.lineWidth = o.plunging ? 2 : o.size;
        ctx.stroke();
      }
    };

    if (reducedMotion) {
      paint(4000);
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
      };
    }

    const loop = (t: number) => {
      paint(t);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else rafId = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="gravity-well"
      style={{ position: "fixed", inset: 0, zIndex: -2, pointerEvents: "none" }}
    />
  );
}
