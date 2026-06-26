import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "OAuth state signing unavailable: META_APP_SECRET is not configured.",
    );
  }
  return secret;
}

export function generateOAuthState(userId: string): string {
  const secret = getSecret();
  const timestamp = Date.now().toString();
  const message = `${userId}:${timestamp}`;
  const hmac = createHmac("sha256", secret).update(message).digest("hex");
  return `${message}:${hmac}`;
}

export function verifyOAuthState(state: string): string | null {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  const parts = state.split(":");
  if (parts.length !== 3) return null;

  const [userId, timestamp, signature] = parts;

  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age < 0 || age > 3600000) {
    return null;
  }

  const expectedMessage = `${userId}:${timestamp}`;
  const expectedSignature = createHmac("sha256", secret).update(expectedMessage).digest("hex");

  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expectedSignature, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return userId;
}
