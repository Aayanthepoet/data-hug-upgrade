import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, MessageSquare, UserPlus, Gavel, Smartphone, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestSms,
  wireSmsTriggers,
} from "@/lib/notifications.functions";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — PropAI" }] }),
  component: NotificationSettingsPage,
});

type Prefs = {
  channel_in_app: boolean;
  channel_sms: boolean;
  sms_phone: string | null;
  on_lead_reply: boolean;
  on_new_lead: boolean;
  on_auction_activity: boolean;
  quiet_enabled: boolean;
  quiet_start_local: string;
  quiet_end_local: string;
  timezone: string;
};

// Common US/EU timezones; user can pick "Browser" to detect
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

function toHHmm(v: string) {
  return v.length >= 5 ? v.slice(0, 5) : v;
}

function NotificationSettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getNotificationPreferences);
  const updateFn = useServerFn(updateNotificationPreferences);
  const testSmsFn = useServerFn(sendTestSms);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => getFn(),
  });

  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    if (!data) return;
    setPrefs({
      channel_in_app: data.channel_in_app,
      channel_sms: data.channel_sms,
      sms_phone: data.sms_phone ?? "",
      on_lead_reply: data.on_lead_reply,
      on_new_lead: data.on_new_lead,
      on_auction_activity: data.on_auction_activity,
      quiet_enabled: data.quiet_enabled,
      quiet_start_local: toHHmm(data.quiet_start_local),
      quiet_end_local: toHHmm(data.quiet_end_local),
      timezone: data.timezone,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      if (!prefs) throw new Error("Not loaded");
      return updateFn({
        data: {
          ...prefs,
          sms_phone: prefs.channel_sms
            ? (prefs.sms_phone ? prefs.sms_phone.replace(/[\s\-().]+/g, "").trim() || null : null)
            : (prefs.sms_phone?.trim() || null),
          quiet_start_local: prefs.quiet_start_local + ":00",
          quiet_end_local: prefs.quiet_end_local + ":00",
        },
      });
    },
    onSuccess: () => {
      toast.success("Notification preferences saved");
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendTest = useMutation({
    mutationFn: (phone: string) => testSmsFn({ data: { phone } }),
    onSuccess: () => toast.success("Test SMS sent — check your phone in a moment."),
    onError: (e: Error) => toast.error(e.message),
  });

  const wireFn = useServerFn(wireSmsTriggers);
  const wireMut = useMutation({
    mutationFn: () => wireFn(),
    onSuccess: (r: { ok: boolean; url: string }) =>
      toast.success(`SMS trigger pipeline wired to ${r.url}`),
    onError: (e: Error) => toast.error(e.message),
  });


  if (isLoading || !prefs) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--w55)]" />
      </div>
    );
  }

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((p) => (p ? { ...p, [key]: value } : p));

  // E.164: leading '+', country code 1-3 digits (no leading 0), then up to 14
  // more digits. Total digits 8-15. Accept user input that may include spaces,
  // dashes, parens — we strip them before validating and before saving.
  const normalizePhone = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    // Keep leading + if present, strip everything non-digit after.
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D+/g, "");
    return hasPlus ? `+${digits}` : digits;
  };
  const E164_RE = /^\+[1-9]\d{7,14}$/;
  const rawPhone = prefs.sms_phone ?? "";
  const normalizedPhone = normalizePhone(rawPhone);
  const phoneTouched = rawPhone.length > 0;
  const phoneValid = E164_RE.test(normalizedPhone);
  const phoneError = prefs.channel_sms && phoneTouched && !phoneValid;
  const phoneBlockingSave = prefs.channel_sms && !phoneValid;

  const browserTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--cyan-d)", border: "1px solid var(--cyan-b)" }}
          >
            <Bell className="h-4 w-4" style={{ color: "var(--cyan)" }} />
          </div>
          <h1 className="text-2xl font-semibold">Notification settings</h1>
        </div>
        <p className="text-sm text-[var(--w55)]">
          Choose which events trigger alerts, where they're delivered, and when to stay quiet.
        </p>
      </header>

      {/* Channels */}
      <section className="surface p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--w55)]">
          Delivery channels
        </h2>

        <Row
          icon={<Bell className="h-4 w-4" />}
          title="In-app notifications"
          desc="Show alerts in the bell icon at the top of the workspace."
        >
          <Switch
            checked={prefs.channel_in_app}
            onCheckedChange={(v) => update("channel_in_app", v)}
          />
        </Row>

        <Row
          icon={<Smartphone className="h-4 w-4" />}
          title="SMS text messages"
          desc="Send alerts to your phone via Twilio."
        >
          <Switch
            checked={prefs.channel_sms}
            onCheckedChange={(v) => update("channel_sms", v)}
          />
        </Row>

        {prefs.channel_sms && (
          <div className="pl-7 space-y-2">
            <Label htmlFor="sms_phone" className="text-xs">
              Mobile number
            </Label>
            <div className="relative max-w-xs">
              <Input
                id="sms_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 415 555 1234"
                value={prefs.sms_phone ?? ""}
                onChange={(e) => update("sms_phone", e.target.value)}
                onBlur={() =>
                  update("sms_phone", normalizePhone(prefs.sms_phone ?? ""))
                }
                aria-invalid={phoneError || undefined}
                aria-describedby="sms_phone_help"
                className={
                  "pr-9 " +
                  (phoneError
                    ? "border-red-500 focus-visible:ring-red-500"
                    : phoneValid && phoneTouched
                      ? "border-emerald-500/60"
                      : "")
                }
              />
              {phoneTouched && (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                  {phoneValid ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Valid number" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" aria-label="Invalid number" />
                  )}
                </span>
              )}
            </div>
            <p
              id="sms_phone_help"
              className={
                "text-xs " +
                (phoneError ? "text-red-500" : "text-[var(--w55)]")
              }
            >
              {phoneError
                ? "Enter your number in E.164 format: a leading + followed by country code and number. Example: +14155551234"
                : "Use E.164 format: + then country code, then number. Spaces and dashes are OK — we'll normalize on save. Example: +1 415 555 1234 → +14155551234."}
            </p>
            {phoneTouched && phoneValid && normalizedPhone !== (prefs.sms_phone ?? "") && (
              <p className="text-xs text-[var(--w55)]">
                Will be saved as <span className="font-mono text-[var(--w70)]">{normalizedPhone}</span>
              </p>
            )}
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!phoneValid || sendTest.isPending}
                onClick={() => sendTest.mutate(normalizedPhone)}
              >
                {sendTest.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <Smartphone className="h-3.5 w-3.5 mr-2" />
                )}
                Send test SMS
              </Button>
              <p className="text-xs text-[var(--w55)] mt-1.5">
                Sends a one-time message to verify delivery. Standard carrier rates apply.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Events */}
      <section className="surface p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--w55)]">
          Alert me when
        </h2>

        <Row
          icon={<MessageSquare className="h-4 w-4" />}
          title="A contacted owner replies"
          desc="Inbound SMS or email replies to your outreach messages."
        >
          <Switch
            checked={prefs.on_lead_reply}
            onCheckedChange={(v) => update("on_lead_reply", v)}
          />
        </Row>

        <Row
          icon={<UserPlus className="h-4 w-4" />}
          title="A new website lead arrives"
          desc="Someone submits the public contact form (admins only)."
        >
          <Switch
            checked={prefs.on_new_lead}
            onCheckedChange={(v) => update("on_new_lead", v)}
          />
        </Row>

        <Row
          icon={<Gavel className="h-4 w-4" />}
          title="Auction activity"
          desc="New bids on your auctions, outbid alerts, and closing results."
        >
          <Switch
            checked={prefs.on_auction_activity}
            onCheckedChange={(v) => update("on_auction_activity", v)}
          />
        </Row>
      </section>

      {/* Quiet hours */}
      <section className="surface p-5 space-y-4">
        <Row
          icon={<Bell className="h-4 w-4" />}
          title="Quiet hours"
          desc="Suppress SMS during a window each day. In-app alerts still appear."
        >
          <Switch
            checked={prefs.quiet_enabled}
            onCheckedChange={(v) => update("quiet_enabled", v)}
          />
        </Row>

        {prefs.quiet_enabled && (
          <div className="pl-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quiet_start" className="text-xs">From</Label>
              <Input
                id="quiet_start"
                type="time"
                value={prefs.quiet_start_local}
                onChange={(e) => update("quiet_start_local", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet_end" className="text-xs">To</Label>
              <Input
                id="quiet_end"
                type="time"
                value={prefs.quiet_end_local}
                onChange={(e) => update("quiet_end_local", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timezone</Label>
              <Select
                value={prefs.timezone}
                onValueChange={(v) =>
                  update("timezone", v === "__browser__" ? browserTz : v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__browser__">
                    Use my browser ({browserTz})
                  </SelectItem>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        {phoneBlockingSave && (
          <span className="text-xs text-red-500">
            Enter a valid E.164 phone number to save SMS alerts.
          </span>
        )}
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || phoneBlockingSave}
        >
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-0.5 text-[var(--w55)]">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-[var(--w55)] mt-0.5">{desc}</div>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
