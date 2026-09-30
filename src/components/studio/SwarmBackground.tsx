"use client";

import * as React from "react";

/**
 * SwarmBackground — a living murmuration behind the studio.
 *
 * A boids flock (separation / alignment / cohesion) rendered as gold glints on
 * the void, the same starling-murmuration imagery senior pointed at — except
 * computed, so it costs nothing, weighs ~5KB and never repeats. It sits at
 * z-index -1 inside the isolated .studio-app stacking context, so it paints
 * above the void background and below every surface, panel and the header.
 *
 * GPU/battery friendly: one small canvas, ~100-170 agents, O(n) spatial-grid
 * neighbor lookups, dt-normalized stepping, paused when the tab is hidden and
 * reduced to a single static frame under prefers-reduced-motion.
 */

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  group: number;
}

interface Pulse {
  x: number;
  y: number;
  elapsed: number;
  duration: number;
  cooldown: number;
}

// Flock geometry — tuned for a slow, gliding, starling-like drift.
const PERCEPTION = 92; // px radius for alignment/cohesion
const PERCEPTION_SQ = PERCEPTION * PERCEPTION;
const SEPARATION = 26; // px personal space
const SEPARATION_SQ = SEPARATION * SEPARATION;
const MAX_SPEED = 1.05; // px per 16.6ms step
const MIN_SPEED = 0.35;
const MAX_FORCE = 0.05;
const COHESION_WEIGHT = 0.5;
const ALIGNMENT_WEIGHT = 0.7;
const SEPARATION_WEIGHT = 1.4;
const EDGE_MARGIN = 96; // soft steering zone at viewport edges
const EDGE_TURN = 0.045;
const PULSE_RADIUS = 240; // raptor-scare density pulse radius

// Gold-on-dark palette, straight from the studio tokens.
const GROUP_COLORS = [
  "rgba(233, 196, 99, 0.55)", // bright gold — the leaders
  "rgba(184, 150, 12, 0.45)", // token gold
  "rgba(184, 150, 12, 0.28)", // dim gold — the body of the flock
  "rgba(200, 196, 188, 0.20)", // faint ivory — depth dust
];

const targetCountFor = (width: number) =>
  width < 640 ? 70 : width < 1100 ? 120 : 170;

export function SwarmBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let boids: Boid[] = [];
    let width = 0;
    let height = 0;
    let rafId = 0;
    let watchdogId = 0;
    let lastTime = performance.now();
    let lastFrameAt = 0;
    let disposed = false;
    const pointer = { x: 0, y: 0, active: false };
    const pulse: Pulse = {
      x: 0,
      y: 0,
      elapsed: 0,
      duration: 1.4,
      cooldown: 5 + Math.random() * 4,
    };

    const spawnBoid = (): Boid => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * MAX_SPEED * 2,
      vy: (Math.random() - 0.5) * MAX_SPEED * 2,
      // Weighted toward the dim body of the flock, sparse bright leaders.
      group: Math.random() < 0.08 ? 0 : Math.random() < 0.5 ? 1 : Math.random() < 0.85 ? 2 : 3,
    });

    const seed = () => {
      const count = targetCountFor(width);
      if (boids.length < count) {
        while (boids.length < count) boids.push(spawnBoid());
      } else if (boids.length > count) {
        boids.length = count;
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const boid of boids) {
        boid.x = Math.min(boid.x, width);
        boid.y = Math.min(boid.y, height);
      }
      seed();
    };

    /** One simulation step; dt is normalized so a dropped frame never warps the flock. */
    const step = (dtMs: number) => {
      const dt = Math.min(dtMs, 100) / 16.666; // clamp huge deltas, normalize to 60fps
      // Rebuild the spatial grid — O(n) neighbor lookups instead of O(n²).
      const cellSize = PERCEPTION;
      const grid = new Map<number, Boid[]>();
      for (const boid of boids) {
        const key =
          Math.floor(boid.y / cellSize) * 4096 + Math.floor(boid.x / cellSize);
        const cell = grid.get(key);
        if (cell) cell.push(boid);
        else grid.set(key, [boid]);
      }

      // Occasional density pulse — the invisible "raptor" that makes a
      // murmuration bunch and swirl instead of settling into a loop.
      pulse.cooldown -= dt * 16.666;
      if (pulse.cooldown <= 0 && pulse.elapsed >= pulse.duration) {
        const anchor = boids[Math.floor(Math.random() * boids.length)];
        if (anchor) {
          pulse.x = anchor.x + (Math.random() - 0.5) * 160;
          pulse.y = anchor.y + (Math.random() - 0.5) * 160;
          pulse.elapsed = 0;
          pulse.cooldown = 6 + Math.random() * 5;
        }
      }
      const pulsing = pulse.elapsed < pulse.duration;
      if (pulsing) pulse.elapsed += dt * 16.666;
      const pulseStrength = pulsing
        ? (1 - pulse.elapsed / pulse.duration) * 0.11
        : 0;

      for (const boid of boids) {
        let sumX = 0;
        let sumY = 0;
        let sumVx = 0;
        let sumVy = 0;
        let sepX = 0;
        let sepY = 0;
        let neighbors = 0;

        const cellX = Math.floor(boid.x / cellSize);
        const cellY = Math.floor(boid.y / cellSize);
        for (let gy = cellY - 1; gy <= cellY + 1; gy++) {
          for (let gx = cellX - 1; gx <= cellX + 1; gx++) {
            const cell = grid.get(gy * 4096 + gx);
            if (!cell) continue;
            for (const other of cell) {
              if (other === boid) continue;
              const dx = other.x - boid.x;
              const dy = other.y - boid.y;
              const distSq = dx * dx + dy * dy;
              if (distSq > PERCEPTION_SQ || distSq === 0) continue;
              sumX += other.x;
              sumY += other.y;
              sumVx += other.vx;
              sumVy += other.vy;
              if (distSq < SEPARATION_SQ) {
                const push = 1 / Math.max(distSq, 1);
                sepX -= dx * push;
                sepY -= dy * push;
              }
              neighbors++;
            }
          }
        }

        let forceX = 0;
        let forceY = 0;
        if (neighbors > 0) {
          // Cohesion — steer toward the local center of mass.
          const targetX = sumX / neighbors;
          const targetY = sumY / neighbors;
          let desiredX = targetX - boid.x;
          let desiredY = targetY - boid.y;
          const cohesionMag = Math.hypot(desiredX, desiredY) || 1;
          forceX += (desiredX / cohesionMag) * MAX_FORCE * COHESION_WEIGHT;
          forceY += (desiredY / cohesionMag) * MAX_FORCE * COHESION_WEIGHT;

          // Alignment — match the average heading of the flock.
          desiredX = sumVx / neighbors;
          desiredY = sumVy / neighbors;
          const alignMag = Math.hypot(desiredX, desiredY) || 1;
          forceX += (desiredX / alignMag) * MAX_FORCE * ALIGNMENT_WEIGHT;
          forceY += (desiredY / alignMag) * MAX_FORCE * ALIGNMENT_WEIGHT;
        }

        // Separation — personal space, strongest of the three rules.
        const sepMag = Math.hypot(sepX, sepY);
        if (sepMag > 0) {
          forceX += (sepX / sepMag) * MAX_FORCE * SEPARATION_WEIGHT;
          forceY += (sepY / sepMag) * MAX_FORCE * SEPARATION_WEIGHT;
        }

        // Soft turn away from the edges — the flock never leaves the frame.
        if (boid.x < EDGE_MARGIN) forceX += EDGE_TURN;
        if (boid.x > width - EDGE_MARGIN) forceX -= EDGE_TURN;
        if (boid.y < EDGE_MARGIN) forceY += EDGE_TURN;
        if (boid.y > height - EDGE_MARGIN) forceY -= EDGE_TURN;

        // The pulse — boids within range bend toward the scare point.
        if (pulseStrength > 0) {
          const dx = pulse.x - boid.x;
          const dy = pulse.y - boid.y;
          const dist = Math.hypot(dx, dy);
          if (dist < PULSE_RADIUS && dist > 1) {
            const weight = pulseStrength * (1 - dist / PULSE_RADIUS);
            forceX += (dx / dist) * weight;
            forceY += (dy / dist) * weight;
          }
        }

        // The cursor is a second scare/anchor — the flock drifts toward it.
        if (pointer.active) {
          const dx = pointer.x - boid.x;
          const dy = pointer.y - boid.y;
          const dist = Math.hypot(dx, dy);
          if (dist < PULSE_RADIUS && dist > 24) {
            const weight = 0.06 * (1 - dist / PULSE_RADIUS);
            forceX += (dx / dist) * weight;
            forceY += (dy / dist) * weight;
          }
        }

        boid.vx += forceX * dt;
        boid.vy += forceY * dt;

        const speed = Math.hypot(boid.vx, boid.vy) || 1;
        if (speed > MAX_SPEED) {
          boid.vx = (boid.vx / speed) * MAX_SPEED;
          boid.vy = (boid.vy / speed) * MAX_SPEED;
        } else if (speed < MIN_SPEED) {
          boid.vx = (boid.vx / speed) * MIN_SPEED;
          boid.vy = (boid.vy / speed) * MIN_SPEED;
        }

        boid.x += boid.vx * dt;
        boid.y += boid.vy * dt;
        boid.x = Math.max(0, Math.min(width, boid.x));
        boid.y = Math.max(0, Math.min(height, boid.y));
      }
    };

    /** Fade previous glints and paint the flock as velocity-aligned comet streaks. */
    const render = (fade: boolean) => {
      if (fade) {
        // destination-out keeps the canvas transparent while old glints decay.
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.clearRect(0, 0, width, height);
      }

      ctx.lineCap = "round";
      for (let group = 0; group < GROUP_COLORS.length; group++) {
        ctx.strokeStyle = GROUP_COLORS[group];
        ctx.lineWidth = group === 0 ? 2 : 1.5;
        ctx.beginPath();
        for (const boid of boids) {
          if (boid.group !== group) continue;
          ctx.moveTo(boid.x - boid.vx * 2.4, boid.y - boid.vy * 2.4);
          ctx.lineTo(boid.x, boid.y);
        }
        ctx.stroke();
      }
    };

    const frame = (now: number) => {
      if (disposed) return;
      const dt = now - lastTime;
      lastTime = now;
      lastFrameAt = now;
      step(dt);
      render(true);
      rafId = requestAnimationFrame(frame);
    };

    const tick = (dtMs: number) => {
      const now = performance.now();
      lastFrameAt = now;
      step(dtMs);
      render(true);
      lastTime = now;
    };

    // Watchdog — occluded windows and battery-saver modes suspend rAF
    // entirely. When frames stall while the page is visible, an interval
    // drives the flock at ~30fps until rAF wakes back up.
    watchdogId = window.setInterval(() => {
      if (disposed || reducedMotion || document.hidden) return;
      if (performance.now() - lastFrameAt > 400) tick(33);
    }, 33);

    const start = () => {
      if (disposed || rafId) return;
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    if (reducedMotion) {
      // No animation — settle the flock and paint one calm, static frame.
      for (let i = 0; i < 160; i++) step(16.666);
      render(false);
    } else {
      start();
    }

    return () => {
      disposed = true;
      stop();
      window.clearInterval(watchdogId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="swarm-background"
    />
  );
}
