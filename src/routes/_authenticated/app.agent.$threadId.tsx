import { createFileRoute, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, type FileUIPart } from "ai";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Sparkles,
  FileDown,
  ListChecks,
  Loader2,
  Paperclip,
  FileText,
  ChevronDown,
} from "lucide-react";
import { exportConversationToPdf } from "@/lib/export-pdf";
import { exportConversationToCsv } from "@/lib/export-csv";
import { TaskPlan, type TaskPlanData } from "@/components/app/TaskPlan";
import { VoiceInputButton } from "@/components/app/VoiceInputButton";
import { AttachmentChips } from "@/components/app/AttachmentChips";
import { getChatThreadMessages } from "@/lib/chat-threads.functions";

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
  PromptInputProvider,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/agent/$threadId")({
  head: () => ({ meta: [{ title: "PropAI Agent" }] }),
  component: ThreadChatPage,
});

const SUGGESTIONS = [
  "Summarize my highest-scoring leads",
  "Which of my properties show the strongest distress signals?",
  "Draft 3 SMS variations to a preforeclosure owner",
  "Show recent inbound leads from the website",
];

function ThreadChatPage() {
  const { threadId } = useParams({ from: "/_authenticated/app/agent/$threadId" });
  const getMessages = useServerFn(getChatThreadMessages);

  const { data, isLoading, error } = useQuery({
    queryKey: ["chat-thread", threadId],
    queryFn: () => getMessages({ data: { threadId } }),
  });

  if (isLoading) {
    return (
      <div className="surface flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--w55)]" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="surface flex-1 flex items-center justify-center text-sm text-red-400">
        {(error as Error)?.message ?? "Could not load conversation"}
      </div>
    );
  }

  return (
    <ChatView
      key={threadId}
      threadId={threadId}
      title={data.thread.title}
      initialMessages={data.messages as unknown as UIMessage[]}
    />
  );
}

function ChatView({
  threadId,
  title,
  initialMessages,
}: {
  threadId: string;
  title: string;
  initialMessages: UIMessage[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? "";
          return { Authorization: `Bearer ${token}` };
        },
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (err) => toast.error(err.message ?? "Something went wrong"),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const [taskMode, setTaskMode] = useState(false);

  async function handleSubmit(message: PromptInputMessage) {
    const text = message.text?.trim();
    if (!text || isLoading) return;
    await sendMessage({ text: taskMode ? `[TASK MODE] ${text}` : text });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        {messages.length > 0 && (
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
                  Ask me to summarize leads, draft outreach, or build a task plan.
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
              placeholder={taskMode ? "Describe what you need a plan for…" : "Ask about your leads, or draft outreach…"}
              autoFocus
            />
            <PromptInputFooter className="justify-between">
              <button
                type="button"
                onClick={() => setTaskMode((v) => !v)}
                className={`inline-flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 border transition ${
                  taskMode
                    ? "border-cyan bg-[var(--cyan-d)] text-cyan"
                    : "border-border text-[var(--w55)] hover:text-foreground"
                }`}
                aria-pressed={taskMode}
              >
                <ListChecks className="h-3.5 w-3.5" />
                Task mode {taskMode ? "on" : "off"}
              </button>
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
