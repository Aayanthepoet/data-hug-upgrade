import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";

export type TaskPlanData = {
  title: string;
  sections: Array<{
    name: string;
    tasks: Array<{
      label: string;
      detail?: string;
      priority?: "high" | "medium" | "low";
    }>;
  }>;
};

const STORAGE_KEY = "propai.agent.tasks.completed.v1";

function loadCompleted(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveCompleted(state: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const priorityColor = {
  high: "var(--cyan)",
  medium: "var(--w55)",
  low: "var(--w35)",
} as const;

export function TaskPlan({ planId, plan }: { planId: string; plan: TaskPlanData }) {
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => loadCompleted());

  useEffect(() => {
    saveCompleted(completed);
  }, [completed]);

  const toggle = (key: string) =>
    setCompleted((prev) => ({ ...prev, [key]: !prev[key] }));

  const total = plan.sections.reduce((sum, s) => sum + s.tasks.length, 0);
  const done = plan.sections.reduce(
    (sum, s) =>
      sum +
      s.tasks.filter((_, i) => completed[`${planId}:${s.name}:${i}`]).length,
    0,
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-cyan" />
          <span className="font-semibold text-sm">{plan.title}</span>
        </div>
        <span className="text-xs text-[var(--w55)]">
          {done}/{total} done
        </span>
      </div>
      <div className="divide-y divide-border">
        {plan.sections.map((section) => (
          <div key={section.name} className="p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--w55)] mb-3">
              {section.name}
            </div>
            <ul className="space-y-2">
              {section.tasks.map((task, i) => {
                const key = `${planId}:${section.name}:${i}`;
                const isDone = !!completed[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full flex items-start gap-3 text-left rounded-lg px-2 py-2 hover:bg-[var(--w05)] transition"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-cyan" />
                      ) : (
                        <Circle className="h-5 w-5 mt-0.5 shrink-0 text-[var(--w35)]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm ${isDone ? "line-through text-[var(--w55)]" : ""}`}
                        >
                          {task.label}
                          {task.priority && (
                            <span
                              className="ml-2 text-[10px] uppercase tracking-wide"
                              style={{ color: priorityColor[task.priority] }}
                            >
                              {task.priority}
                            </span>
                          )}
                        </div>
                        {task.detail && (
                          <div
                            className={`text-xs mt-1 ${isDone ? "text-[var(--w35)]" : "text-[var(--w55)]"}`}
                          >
                            {task.detail}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
