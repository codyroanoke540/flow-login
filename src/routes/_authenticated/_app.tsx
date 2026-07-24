import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { AiEmployeeLauncher } from "@/components/ai-employee/ai-employee-launcher";
import { getSession } from "@/lib/cadence.functions";
import { TerminologyProvider } from "@/lib/terminology";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AppShell,
});

function AppShell() {
  const { user } = Route.useRouteContext();
  const sessionFn = useServerFn(getSession);
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => sessionFn(),
    staleTime: 60_000,
  });
  const orgName = (session?.active_organization as any)?.name ?? null;
  const role = (session?.role as string | null) ?? null;
  const terminology = (session?.settings as any)?.terminology ?? {};
  const aiEmployeeEnabled = (session?.settings as any)?.feature_flags?.ai_employee_enabled === true;

  return (
    <TerminologyProvider value={terminology}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar role={role} />
          <SidebarInset className="flex min-w-0 flex-1 flex-col">
            <AppTopbar email={user?.email} orgName={orgName} />
            <main className="flex-1 min-w-0 pb-24 md:pb-8">
              <Outlet />
            </main>
            {aiEmployeeEnabled && <AiEmployeeLauncher />}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TerminologyProvider>
  );
}