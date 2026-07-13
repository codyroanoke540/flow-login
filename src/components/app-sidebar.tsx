import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Contact,
  BarChart3,
  Sparkles,
  Workflow,
  Plug,
  Settings,
  CalendarClock,
  Radar,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const primary = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Operations Center", url: "/operations", icon: Radar },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Customers", url: "/customers", icon: Contact },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
] as const;

const intelligence = [
  { title: "AI Recommendations", url: "/ai", icon: Sparkles },
  { title: "Automations", url: "/automations", icon: Workflow },
] as const;

const system = [
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const renderItems = (items: readonly { title: string; url: string; icon: typeof LayoutDashboard }[]) => (
    <SidebarMenu>
      {items.map((item) => {
        const active = pathname === item.url || pathname.startsWith(item.url + "/");
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
              <Link to={item.url} className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-2">
          <div
            className="grid h-8 w-8 place-items-center rounded-md text-white"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <CalendarClock className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-semibold">Cadence</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Operations</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Operations</SidebarGroupLabel>}
          <SidebarGroupContent>{renderItems(primary)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Intelligence</SidebarGroupLabel>}
          <SidebarGroupContent>{renderItems(intelligence)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>System</SidebarGroupLabel>}
          <SidebarGroupContent>{renderItems(system)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}