import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
} from "lucide-react";

const items = [
  { title: "Overview", url: "/app", icon: LayoutDashboard, exact: true },
  { title: "PropAI Agent", url: "/app/agent", icon: Bot },
  { title: "Leads", url: "/app/leads", icon: Inbox },
  { title: "Properties", url: "/app/properties", icon: Building2 },
  { title: "Find Distressed", url: "/app/properties/search", icon: Search },
  { title: "Owners", url: "/app/owners", icon: Users },
  { title: "Contacts (Resolver)", url: "/app/contacts", icon: PhoneCall },
  { title: "Lead Lists", url: "/app/lead-lists", icon: ListChecks },
  { title: "Campaigns (Language)", url: "/app/campaigns", icon: Megaphone },
  { title: "Vision Studio", url: "/app/vision", icon: Eye },
  { title: "Videos (Voice+Video)", url: "/app/videos", icon: Clapperboard },
  
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

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
    </Sidebar>
  );
}
