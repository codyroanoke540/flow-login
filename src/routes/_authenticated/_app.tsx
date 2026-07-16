import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { AiEmployeeLauncher } from "@/components/ai-employee/ai-employee-launcher";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AppShell,
});

function AppShell() {
  const { user } = Route.useRouteContext();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppTopbar email={user?.email} />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
          <AiEmployeeLauncher />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}