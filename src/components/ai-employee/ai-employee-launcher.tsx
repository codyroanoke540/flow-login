import { useState } from "react";
import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AiEmployeePanel } from "./ai-employee-panel";

/**
 * Floating launcher for the AI Employee. Mounted once inside the
 * authenticated app shell so it is available on every page.
 */
export function AiEmployeeLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-4 right-4 z-40 h-12 gap-2 rounded-full px-5 text-white shadow-lg sm:bottom-5 sm:right-5"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      >
        <Bot className="h-4 w-4" />
        <span className="hidden sm:inline">Ask AI</span>
      </Button>
      <AiEmployeePanel open={open} onOpenChange={setOpen} />
    </>
  );
}