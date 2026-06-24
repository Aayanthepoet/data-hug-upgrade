import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Building2,
  Users,
  PhoneCall,
  ListChecks,
  Megaphone,
  Clapperboard,
  Bot,
  Inbox,
  Search,
  Eye,
  Bookmark,
  Flame,
  Gavel,
  Send,
  ScrollText,
  ShieldOff,
  LogOut,
  Settings,
  Share2,
  History as HistoryIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Overview", url: "/app", icon: LayoutDashboard, exact: true },
  { title: "PropAI Agent", url: "/app/agent", icon: Bot },
  { title: "Leads", url: "/app/leads", icon: Inbox },
  { title: "Lead Scoring", url: "/app/scoring", icon: Flame },
  { title: "Properties", url: "/app/properties", icon: Building2 },
  { title: "Address Lookup", url: "/app/properties/lookup", icon: Search },
  { title: "Lookup History", url: "/app/properties/lookup-history", icon: HistoryIcon },
  { title: "Find Distressed", url: "/app/properties/search", icon: Search },
  { title: "Auctions", url: "/app/auctions", icon: Gavel },
  { title: "Watchlist", url: "/app/watchlist", icon: Bookmark },
  { title: "Owners", url: "/app/owners", icon: Users },
  { title: "Contacts (Resolver)", url: "/app/contacts", icon: PhoneCall },
  { title: "Lead Lists", url: "/app/lead-lists", icon: ListChecks },
  { title: "Campaigns (Language)", url: "/app/campaigns", icon: Megaphone },
  { title: "Outreach", url: "/app/outreach", icon: Send },
  { title: "Vision Studio", url: "/app/vision", icon: Eye },
  { title: "Videos (Voice+Video)", url: "/app/videos", icon: Clapperboard },
  { title: "Social Amplifier", url: "/app/social", icon: Share2 },
  { title: "Audit Log", url: "/app/audit", icon: ScrollText },
  { title: "SMS Opt-outs", url: "/app/opt-outs", icon: ShieldOff },
  { title: "Settings", url: "/app/settings", icon: Settings },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {user && (
        <SidebarFooter className="border-t border-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/20"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && (
                  <span className="flex-1 text-left truncate text-xs">
                    {user.email}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
