// Central terminology so future industry modules can rename core nouns
// without touching component code.
export type Terminology = {
  customer: string;
  customers: string;
  employee: string;
  employees: string;
  appointment: string;
  appointments: string;
  organization: string;
};

export const defaultTerminology: Terminology = {
  customer: "Customer",
  customers: "Customers",
  employee: "Employee",
  employees: "Employees",
  appointment: "Appointment",
  appointments: "Appointments",
  organization: "Organization",
};

export function useTerminology(): Terminology {
  return defaultTerminology;
}