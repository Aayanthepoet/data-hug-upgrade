import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Sparkles, Trash2, FileDown, ListChecks } from "lucide-react";
import { exportConversationToPdf } from "@/lib/export-pdf";
import { TaskPlan, type TaskPlanData } from "@/components/app/TaskPlan";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/agent")({
  head: () => ({ meta: [{ title: "PropAI Agent" }] }),
  component: AgentPage,
});

const STORAGE_KEY = "propai.agent.messages.v1";

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  "Summarize my highest-scoring leads",
  "Which of my properties show the strongest distress signals?",
  "Draft 3 SMS variations to a preforeclosure owner",
  "Show recent inbound leads from the website",
];

function AgentPage() {
  const initialMessages = useMemo(loadMessages, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? "";
          return { Authorization: `Bearer ${token}` };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: "propai-agent",
    messages: initialMessages,
    transport,
    onError: (err) => toast.error(err.message ?? "Something went wrong"),
  });

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore quota */
    }
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";
  const [taskMode, setTaskMode] = useState(false);

  async function handleSubmit(message: PromptInputMessage) {
    const text = message.text?.trim();
    if (!text || isLoading) return;
    await sendMessage({ text: taskMode ? `[TASK MODE] ${text}` : text });
  }

  function newConversation() {
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-5rem)] min-h-[500px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="eyebrow inline-flex">
            <span className="eyebrow-dot" />
            PropAI Agent
          </div>
          <h1 className="h-display text-[clamp(28px,4vw,40px)] mt-3">
            Chat with your <span className="h-italic">data</span>
          </h1>
        </div>
        {messages.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  exportConversationToPdf(messages);
                  toast.success("PDF report downloaded");
                } catch (e) {
                  toast.error((e as Error).message ?? "Failed to export PDF");
                }
              }}
            >
              <FileDown className="h-4 w-4 mr-2" /> Export PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={newConversation}>
              <Trash2 className="h-4 w-4 mr-2" /> New chat
            </Button>
          </div>
        )}
      </div>

      <div className="surface flex-1 flex flex-col overflow-hidden">
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "var(--cyan-d)", border: "1px solid var(--cyan-b)" }}
                >
                  <Bot className="h-7 w-7" style={{ color: "var(--cyan)" }} />
                </div>
                <h2 className="text-xl font-semibold">PropAI Agent</h2>
                <p className="text-sm text-[var(--w55)] mt-2 max-w-md">
                  I can read your properties, owners, and contacts. Ask me to summarize leads or draft outreach.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-xl">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage({ text: s })}
                      className="text-left text-sm rounded-lg border border-border px-4 py-3 hover:border-cyan hover:bg-[var(--cyan-d)] transition"
                    >
                      <Sparkles className="h-3.5 w-3.5 inline mr-2 text-cyan" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <Message key={m.id} from={m.role}>
                {m.role === "user" ? (
                  <MessageContent>
                    {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
                  </MessageContent>
                ) : (
                  <div className="w-full space-y-3">
                    {m.parts.map((part, i) => {
                      if (part.type === "text") {
                        return (
                          <div key={i} className="prose prose-sm prose-invert max-w-none">
                            <ReactMarkdown>{part.text}</ReactMarkdown>
                          </div>
                        );
                      }
                      if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                        const tp = part as {
                          type: string;
                          toolCallId?: string;
                          state?: string;
                          input?: unknown;
                          output?: unknown;
                          errorText?: string;
                        };
                        if (
                          tp.type === "tool-create_task_plan" &&
                          tp.output &&
                          typeof tp.output === "object"
                        ) {
                          return (
                            <TaskPlan
                              key={tp.toolCallId ?? i}
                              planId={tp.toolCallId ?? `${m.id}:${i}`}
                              plan={tp.output as TaskPlanData}
                            />
                          );
                        }
                        const state =
                          (tp.state as
                            | "input-streaming"
                            | "input-available"
                            | "output-available"
                            | "output-error"
                            | undefined) ?? "output-available";
                        return (
                          <Tool key={tp.toolCallId ?? i} defaultOpen={false}>
                            <ToolHeader type={tp.type as `tool-${string}`} state={state} />
                            <ToolContent>
                              <ToolInput input={tp.input} />
                              <ToolOutput
                                output={tp.output as React.ReactNode}
                                errorText={tp.errorText}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </Message>
            ))}

            {status === "submitted" && (
              <Message from="assistant">
                <Shimmer>Thinking…</Shimmer>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border p-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              placeholder="Ask about your leads, or draft outreach…"
              autoFocus
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={status}
                onClick={isLoading ? () => stop() : undefined}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

