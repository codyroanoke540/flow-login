import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/operations" });
  },
});