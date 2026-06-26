// AES-256-GCM at-rest encryption for third-party access tokens (Meta Pages,
// Instagram, etc.). Stored values are tagged with a version prefix so we can
// safely migrate legacy plaintext rows on read.
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

const ENC_PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY is not configured (need >= 32 chars).",
    );
  }
  cachedKey = scryptSync(raw, "propai-social-token-v1", 32);
  return cachedKey;
}

export function encryptToken(plain: string): string {
  if (!plain) return plain;
  if (plain.startsWith(ENC_PREFIX)) return plain;
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Returns plaintext, or null if the ciphertext is unreadable. Legacy
 *  plaintext rows (without the prefix) are returned as-is. */
export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const key = getKey();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}
