/**
 * Key vault — AES-256-GCM encryption for user-supplied provider keys.
 * Secret comes from BILLING_SECRET env (32+ chars). Refuses to operate
 * without it — BYOK keys are NEVER stored in plaintext.
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

function secretKey(): Buffer {
  const secret = process.env.BILLING_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("BILLING_SECRET missing (min 32 chars) — set it to enable BYOK key storage.");
  }
  return scryptSync(secret, "gravity-byok-v1", 32);
}

/** "v1.<iv-hex>.<authTag-hex>.<cipher-hex>" */
export function encryptKey(plaintext: string): string {
  const key = secretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1.${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${enc.toString("hex")}`;
}

export function decryptKey(payload: string): string {
  const [v, ivHex, tagHex, dataHex] = payload.split(".");
  if (v !== "v1" || !ivHex || !tagHex || !dataHex) throw new Error("bad key payload");
  const key = secretKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

export function maskKey(key: string): string {
  const tail = key.slice(-4);
  return `${key.slice(0, 6)}…${tail}`;
}
