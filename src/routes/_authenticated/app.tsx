import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Workspace — PropAI" }] }),
  component: AppShell,
});

function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-[rgba(6,10,18,.85)] backdrop-blur sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Link to="/" className="font-bold">
                Prop<span className="text-cyan">AI</span>
              </Link>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[var(--w55)] hidden sm:inline">{user?.email}</span>
              <button onClick={signOut} className="btn-ghost text-xs px-4 py-2">
                Sign out
              </button>
            </div>
          </header>
          <main className="flex-1 px-6 md:px-10 py-10 max-w-6xl w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
