import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/ai")({
  beforeLoad: () => {
    throw redirect({ to: "/operations" });
  },
});