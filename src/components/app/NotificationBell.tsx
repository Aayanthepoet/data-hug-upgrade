import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, Trash2, Settings as SettingsIcon, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  listNotifications,
  markNotificationsRead,
  deleteNotification,
} from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  lead_reply: "Reply",
  new_lead: "New lead",
  auction_activity: "Auction",
};

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationsRead);
  const delFn = useServerFn(deleteNotification);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listFn(),
    enabled: !!user?.id,
  });

  const unread = items.filter((n) => !n.read_at);
  const unreadCount = unread.length;

  // Realtime subscription: invalidate on any change to my notifications
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const markAll = useMutation({
    mutationFn: () => markFn({ data: { all: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markFn({ data: { ids: [id] } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const removeOne = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          className="relative p-2 rounded-lg hover:bg-card transition text-[var(--w55)] hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-cyan text-[10px] font-semibold text-background flex items-center justify-center"
              style={{ background: "var(--cyan)" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="text-sm font-semibold">Notifications</div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="text-xs text-[var(--w55)] hover:text-foreground px-2 py-1 rounded transition"
              >
                Mark all read
              </button>
            )}
            <Link
              to="/app/notifications"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded hover:bg-card text-[var(--w55)] hover:text-foreground transition"
              aria-label="Notification settings"
              title="Notification settings"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--w55)]" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--w55)]">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const isUnread = !n.read_at;
                const content = (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-cyan font-semibold">
                        {TYPE_LABEL[n.type] ?? n.type}
                      </span>
                      <span className="text-[10px] text-[var(--w55)]">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className={cn("text-sm truncate", isUnread && "font-semibold")}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-xs text-[var(--w55)] line-clamp-2 mt-0.5">
                        {n.body}
                      </div>
                    )}
                  </div>
                );
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "group flex items-start gap-2 px-3 py-2.5 hover:bg-card/50 transition",
                      isUnread && "bg-[var(--cyan-d)]/30",
                    )}
                  >
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => {
                          setOpen(false);
                          if (isUnread) markOne.mutate(n.id);
                        }}
                        className="flex-1 min-w-0"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex-1 min-w-0">{content}</div>
                    )}
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markOne.mutate(n.id)}
                          className="p-1 rounded hover:bg-background text-[var(--w55)] hover:text-foreground"
                          aria-label="Mark as read"
                          title="Mark as read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeOne.mutate(n.id)}
                        className="p-1 rounded hover:bg-background text-[var(--w55)] hover:text-red-400"
                        aria-label="Delete notification"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
