import { createFileRoute } from "@tanstack/react-router";
import { EmployeesPage } from "@/components/employees/EmployeesPage";

export const Route = createFileRoute("/_authenticated/_app/employees")({
  head: () => ({ meta: [{ title: "Employees — Cadence" }] }),
  component: EmployeesPage,
});