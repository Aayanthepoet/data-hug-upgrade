import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { NotificationBell } from "@/components/app/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import logoAsset from "@/assets/ainetworkagency-logo.png.asset.json";

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
              <Link to="/" className="flex items-center gap-3 font-bold">
                <img src={logoAsset.url} alt="AI Network Agency Logo" className="h-7 w-auto rounded bg-white p-0.5" />
                <span className="border-l border-border pl-3 text-xs font-medium text-[var(--w65)]">
                  Prop<span className="text-cyan">AI</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <NotificationBell />
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
