import { createHmac } from "crypto";

export function generateOAuthState(userId: string): string {
  const secret = process.env.META_APP_SECRET || "default_oauth_state_secret_123";
  const timestamp = Date.now().toString();
  const message = `${userId}:${timestamp}`;
  const hmac = createHmac("sha256", secret).update(message).digest("hex");
  return `${message}:${hmac}`;
}

export function verifyOAuthState(state: string): string | null {
  const secret = process.env.META_APP_SECRET || "default_oauth_state_secret_123";
  const parts = state.split(":");
  if (parts.length !== 3) return null;
  
  const [userId, timestamp, signature] = parts;
  
  // Verify timestamp is within 1 hour (3600000 ms)
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age < 0 || age > 3600000) {
    return null;
  }
  
  const expectedMessage = `${userId}:${timestamp}`;
  const expectedSignature = createHmac("sha256", secret).update(expectedMessage).digest("hex");
  
  if (signature === expectedSignature) {
    return userId;
  }
  return null;
}
