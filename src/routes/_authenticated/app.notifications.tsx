import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, MessageSquare, UserPlus, Gavel, Smartphone, Loader2 } from "lucide-react";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
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
          sms_phone: prefs.sms_phone?.trim() || null,
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

  if (isLoading || !prefs) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--w55)]" />
      </div>
    );
  }

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((p) => (p ? { ...p, [key]: value } : p));

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
              SMS number (E.164 format, e.g. +14155551234)
            </Label>
            <Input
              id="sms_phone"
              type="tel"
              inputMode="tel"
              placeholder="+14155551234"
              value={prefs.sms_phone ?? ""}
              onChange={(e) => update("sms_phone", e.target.value)}
              className="max-w-xs"
            />
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

      <div className="flex justify-end gap-3">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
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
