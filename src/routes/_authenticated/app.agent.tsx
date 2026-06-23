import { createFileRoute, Outlet, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bot, Plus, Trash2, MessageSquare, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  listChatThreads,
  createChatThread,
  deleteChatThread,
  updateChatThreadTitle,
} from "@/lib/chat-threads.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/agent")({
  head: () => ({ meta: [{ title: "PropAI Agent" }] }),
  component: AgentLayout,
});

function AgentLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const listFn = useServerFn(listChatThreads);
  const createFn = useServerFn(createChatThread);
  const deleteFn = useServerFn(deleteChatThread);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => listFn(),
  });

  const create = useMutation({
    mutationFn: () => createFn(),
    onSuccess: (thread) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/app/agent/$threadId", params: { threadId: thread.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (threadId: string) => deleteFn({ data: { threadId } }),
    onSuccess: (_d, threadId) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      if (threadId === activeId) navigate({ to: "/app/agent" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-redirect to most recent thread when landing on bare /app/agent
  useEffect(() => {
    if (activeId) return;
    if (isLoading) return;
    if (threads.length > 0) {
      navigate({
        to: "/app/agent/$threadId",
        params: { threadId: threads[0].id },
        replace: true,
      });
    }
  }, [activeId, isLoading, threads, navigate]);

  return (
    <div className="flex h-[calc(100vh-3.5rem-5rem)] min-h-[500px] gap-4">
      {/* Thread sidebar */}
      <aside className="w-64 shrink-0 surface flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="w-full justify-start"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && (
            <div className="text-xs text-[var(--w55)] px-2 py-3">Loading…</div>
          )}
          {!isLoading && threads.length === 0 && (
            <div className="text-xs text-[var(--w55)] px-2 py-3">
              No conversations yet. Start one with "New chat".
            </div>
          )}
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg pr-1 transition",
                activeId === t.id
                  ? "bg-[var(--cyan-d)] border border-[var(--cyan-b)]"
                  : "border border-transparent hover:bg-card/50",
              )}
            >
              <Link
                to="/app/agent/$threadId"
                params={{ threadId: t.id }}
                className="flex-1 flex items-center gap-2 px-2 py-2 text-sm min-w-0"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--w55)]" />
                <span className="truncate">{t.title}</span>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm("Delete this conversation?")) remove.mutate(t.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-card text-[var(--w55)] hover:text-red-400 transition"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Active chat area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {activeId ? (
          <Outlet />
        ) : (
          <div className="surface flex-1 flex flex-col items-center justify-center text-center px-6">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "var(--cyan-d)", border: "1px solid var(--cyan-b)" }}
            >
              <Bot className="h-7 w-7" style={{ color: "var(--cyan)" }} />
            </div>
            <h2 className="text-xl font-semibold">PropAI Agent</h2>
            <p className="text-sm text-[var(--w55)] mt-2 max-w-md">
              Start a new conversation to chat with your data, draft outreach, or build task plans.
            </p>
            <Button className="mt-6" onClick={() => create.mutate()} disabled={create.isPending}>
              <Plus className="h-4 w-4 mr-2" /> New chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
