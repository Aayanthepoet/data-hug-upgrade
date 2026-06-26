import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { NotificationBell } from "@/components/app/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import logoAsset from "@/assets/ainetworkagency-logo.png.asset.json";
import { ArrowLeft, Home } from "lucide-react";
import { SubscriptionGate } from "@/components/billing/SubscriptionGate";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Workspace — PropAI" }] }),
  component: AppShell,
});

function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();


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
              <Link
                to="/"
                className="ml-2 hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20 hover:border-cyan transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t("common.backToLanding")}</span>
              </Link>
              <Link
                to="/"
                aria-label="Back to landing page"
                className="ml-2 sm:hidden flex items-center justify-center h-8 w-8 rounded-md border border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20 transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <LanguageSwitcher compact />
              <NotificationBell />
              <span className="text-[var(--w55)] hidden md:inline">{user?.email}</span>
              <button onClick={signOut} className="btn-ghost text-xs px-4 py-2">
                {t("common.signOut")}
              </button>
            </div>
          </header>
          <main className="flex-1 px-6 md:px-10 py-10 max-w-6xl w-full">
            <SubscriptionGate>
              <Outlet />
            </SubscriptionGate>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
