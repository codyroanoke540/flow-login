import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Contact,
  Settings,
  CalendarClock,
  Radar,
  History,
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
  { title: "Operations Center", url: "/operations", icon: Radar },
  { title: "Schedule", url: "/schedule", icon: CalendarDays },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Customers", url: "/customers", icon: Contact },
] as const;

const system = [
  { title: "Audit history", url: "/audit", icon: History, requiresRole: ["owner", "admin"] as string[] },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar({ role }: { role?: string | null }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const renderItems = (
    items: readonly { title: string; url: string; icon: typeof LayoutDashboard; requiresRole?: string[] }[],
  ) => (
    <SidebarMenu>
      {items
        .filter((item) => !item.requiresRole || (role && item.requiresRole.includes(role)))
        .map((item) => {
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
        <Link to="/operations" className="flex items-center gap-2 px-2 py-2">
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
          {!collapsed && <SidebarGroupLabel>System</SidebarGroupLabel>}
          <SidebarGroupContent>{renderItems(system)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}