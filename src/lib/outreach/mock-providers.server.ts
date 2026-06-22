// Mock outreach providers. Deterministic message IDs so the same input is
// idempotent across retries; ~95% success rate so the UI exercises both
// happy + failure paths.
import type {
  OutreachChannel,
  OutreachProvider,
  OutreachSendInput,
  OutreachSendResult,
} from "./provider";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fakeId(prefix: string, input: OutreachSendInput): string {
  const seed = hash(`${input.channel}|${input.to}|${input.body}`);
  return `${prefix}_${seed.toString(36)}`;
}

const sms: OutreachProvider = {
  channel: "sms",
  async send(input) {
    if (!input.to.match(/^\+?\d{7,15}$/)) {
      return { provider: "mock-sms", providerMessageId: fakeId("sm", input), status: "failed", error: "Invalid phone" };
    }
    const fail = hash(input.to) % 20 === 0;
    return {
      provider: "mock-sms",
      providerMessageId: fakeId("sm", input),
      status: fail ? "failed" : "sent",
      ...(fail ? { error: "Carrier rejected" } : {}),
    };
  },
};

const email: OutreachProvider = {
  channel: "email",
  async send(input) {
    if (!input.to.includes("@")) {
      return { provider: "mock-email", providerMessageId: fakeId("em", input), status: "failed", error: "Invalid email" };
    }
    const fail = hash(input.to) % 25 === 0;
    return {
      provider: "mock-email",
      providerMessageId: fakeId("em", input),
      status: fail ? "failed" : "sent",
      ...(fail ? { error: "Hard bounce" } : {}),
    };
  },
};

const mail: OutreachProvider = {
  channel: "mail",
  async send(input) {
    if (input.to.length < 10) {
      return { provider: "mock-mail", providerMessageId: fakeId("ml", input), status: "failed", error: "Invalid address" };
    }
    // Direct mail is async — record as "queued" awaiting print/ship.
    return { provider: "mock-mail", providerMessageId: fakeId("ml", input), status: "queued" };
  },
};

const REGISTRY: Record<OutreachChannel, OutreachProvider> = { sms, email, mail };

export function getOutreachProvider(channel: OutreachChannel): OutreachProvider {
  return REGISTRY[channel];
}

export function dispatch(input: OutreachSendInput): Promise<OutreachSendResult> {
  return getOutreachProvider(input.channel).send(input);
}
