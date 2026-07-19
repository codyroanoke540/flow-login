import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/automations")({
  beforeLoad: () => {
    throw redirect({ to: "/operations" });
  },
});