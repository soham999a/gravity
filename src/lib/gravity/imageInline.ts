/**
 * Firestore-only image persistence — NO Firebase Storage needed.
 *
 * Paid renders come back as ~1.8MB PNG bytes, but a Firestore doc caps at
 * 1 MiB. So: decode → re-encode as JPEG (quality ladder 80→60→40) until the
 * data-URL fits (~600KB ceiling leaves headroom for the rest of the doc).
 * The UI renders data-URLs natively (<img src>, "open full size" link).
 *
 * Pure-JS codecs (pngjs + jpeg-js): no native builds, Vercel Hobby safe.
 * Throws when bytes can't be squeezed small — caller falls back to
 * Pollinations, so this is strictly an upgrade path, never a breakage.
 */

import { PNG } from "pngjs";
import * as jpeg from "jpeg-js";

/** Firestore doc cap is 1 MiB — stay well under so the node doc fits. */
export const MAX_INLINE_IMAGE_BYTES = 600_000;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function magic(buf: Buffer, sig: number[]): boolean {
  return sig.every((b, i) => buf[i] === b);
}

export interface InlineImage {
  dataUrl: string;
  bytes: number;
  quality: number;
}

/** Cap longest edge so photographic renders fit Firestore after JPEG. */
const MAX_EDGE = 1280;

/** Bilinear downscale of an RGBA buffer (pure JS, one-off cost ~100ms). */
function downscale(
  src: Buffer,
  w: number,
  h: number,
  maxEdge: number,
): { width: number; height: number; data: Buffer } {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  if (scale >= 1) return { width: w, height: h, data: src };
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  const out = Buffer.alloc(dw * dh * 4);
  const xRatio = (w - 1) / dw;
  const yRatio = (h - 1) / dh;
  for (let y = 0; y < dh; y++) {
    const sy = y * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = x * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;
      const o = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = src[(y0 * w + x0) * 4 + c]!;
        const b = src[(y0 * w + x1) * 4 + c]!;
        const cc = src[(y1 * w + x0) * 4 + c]!;
        const d = src[(y1 * w + x1) * 4 + c]!;
        out[o + c] = Math.round(a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + cc * (1 - fx) * fy + d * fx * fy);
      }
    }
  }
  return { width: dw, height: dh, data: out };
}

/**
 * Any common raster bytes (PNG from OpenRouter, JPEG, …) → Firestore-safe
 * JPEG data-URL. Never returns oversized output — throws instead.
 */
export function toFirestoreImage(input: Buffer): InlineImage {
  let rgba: { width: number; height: number; data: Buffer };
  if (magic(input, PNG_MAGIC)) {
    rgba = PNG.sync.read(input);
  } else if (magic(input, JPEG_MAGIC)) {
    const decoded = jpeg.decode(input, { useTArray: true, maxMemoryUsageInMB: 512 });
    rgba = { width: decoded.width, height: decoded.height, data: Buffer.from(decoded.data) };
  } else {
    throw new Error("unsupported image bytes (not PNG/JPEG)");
  }
  if (!rgba.width || !rgba.height || rgba.data.length < 100) {
    throw new Error("could not decode image bytes");
  }
  const small = downscale(rgba.data, rgba.width, rgba.height, MAX_EDGE);

  // Quality ladder: first fit wins (best surviving quality).
  for (const quality of [80, 60, 40]) {
    const encoded = jpeg.encode(
      { width: small.width, height: small.height, data: small.data },
      quality,
    );
    if (encoded.data.length <= MAX_INLINE_IMAGE_BYTES) {
      const b64 = Buffer.from(encoded.data).toString("base64");
      return {
        dataUrl: `data:image/jpeg;base64,${b64}`,
        bytes: encoded.data.length,
        quality,
      };
    }
  }
  throw new Error(
    `image too large for Firestore even capped at ${MAX_EDGE}px q40 — enable Firebase Storage for HD persistence`,
  );
}
