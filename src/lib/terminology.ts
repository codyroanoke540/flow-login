// Central terminology so industry modules can rename core nouns without
// touching component code. Values are pulled from `organization_settings.terminology`
// (a JSON blob) via the TerminologyProvider mounted in the authenticated shell.
import { createContext, useContext, type ReactNode, createElement } from "react";

export type Terminology = {
  customer: string;
  customers: string;
  employee: string;
  employees: string;
  appointment: string;
  appointments: string;
  organization: string;
  qualification: string;
  qualifications: string;
};

export const defaultTerminology: Terminology = {
  customer: "Customer",
  customers: "Customers",
  employee: "Employee",
  employees: "Employees",
  appointment: "Appointment",
  appointments: "Appointments",
  organization: "Organization",
  qualification: "Qualification",
  qualifications: "Qualifications",
};

const Ctx = createContext<Terminology>(defaultTerminology);

export function TerminologyProvider({
  value,
  children,
}: {
  value: Partial<Terminology> | null | undefined;
  children: ReactNode;
}) {
  const merged: Terminology = { ...defaultTerminology, ...(value ?? {}) };
  return createElement(Ctx.Provider, { value: merged }, children);
}

export function useTerminology(): Terminology {
  return useContext(Ctx);
}