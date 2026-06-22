// Outreach provider interface. Mock today, real providers (Twilio, Resend,
// Lob, etc.) swap in behind the same surface later.

export type OutreachChannel = "sms" | "email" | "mail";

export interface OutreachSendInput {
  channel: OutreachChannel;
  to: string;              // phone (E.164), email, or formatted street address
  subject?: string | null; // email only
  body: string;
}

export interface OutreachSendResult {
  provider: string;
  providerMessageId: string;
  status: "queued" | "sent" | "failed";
  error?: string;
}

export interface OutreachProvider {
  channel: OutreachChannel;
  send(input: OutreachSendInput): Promise<OutreachSendResult>;
}
