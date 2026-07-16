import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AI_ROLE_LIST, AI_ROLES, DEFAULT_ROLE, type AiRoleId } from "@/lib/ai/roles";
import { loadMemory, memorySummary, rememberTurn } from "@/lib/ai/memory";
import { describePage } from "./page-context";

type Msg = { role: "user" | "assistant"; content: string; id: string };

function newId() {
  return Math.random().toString(36).slice(2);
}

export function AiEmployeePanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const page = useMemo(() => describePage(pathname), [pathname]);

  const [role, setRole] = useState<AiRoleId>(DEFAULT_ROLE);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const activeRole = AI_ROLES[role];

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const userMsg: Msg = { role: "user", content, id: newId() };
    const assistantMsg: Msg = { role: "assistant", content: "", id: newId() };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    rememberTurn("user", content);

    try {
      const res = await fetch("/api/ai-employee", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          pageContext: { pathname: page.pathname, title: page.title, summary: page.summary },
          memory: memorySummary(),
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "Request failed");
        throw new Error(err || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") next[next.length - 1] = { ...last, content: acc };
          return next;
        });
      }
      rememberTurn("assistant", acc);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "AI Employee unreachable";
      toast.error(msg);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          next[next.length - 1] = { ...last, content: `⚠️ ${msg}` };
        }
        return next;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => textareaRef.current?.focus(), 30);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const mem = loadMemory();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="grid h-9 w-9 place-items-center rounded-full text-white"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="font-display text-base">AI Employee</SheetTitle>
                <SheetDescription className="text-xs">
                  {activeRole.title} · aware of {page.title}
                </SheetDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3">
            <Select value={role} onValueChange={(v) => setRole(v as AiRoleId)}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_ROLE_LIST.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    <span className="font-medium">{r.title}</span>
                    <span className="ml-2 text-muted-foreground">{r.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-5 py-5">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-xl border bg-secondary/40 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Ready
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    Hi — I'm your {activeRole.title}. I can answer questions, propose schedule changes, draft messages, and prepare reports. The scheduling engine stays the source of truth; I never bypass it.
                  </p>
                  {mem.recentTurns.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Remembering {mem.recentTurns.length} recent turns and {Object.keys(mem.preferences).length} preferences.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Try</p>
                  <div className="flex flex-col gap-1.5">
                    {page.prompts.map((p) => (
                      <button
                        key={p}
                        onClick={() => void send(p)}
                        className="rounded-lg border bg-card px-3 py-2 text-left text-sm text-foreground transition hover:bg-accent"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    {m.content || (streaming ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                        Thinking…
                      </span>
                    ) : null)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t bg-background p-4">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">L1 read-only auto</Badge>
            <Badge variant="outline" className="text-[10px]">L2 needs approval</Badge>
            <Badge variant="outline" className="text-[10px]">L3 always confirms</Badge>
          </div>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Message ${activeRole.title}…`}
              rows={2}
              className="resize-none pr-11"
              disabled={streaming}
            />
            <Button
              size="icon"
              onClick={() => void send(input)}
              disabled={streaming || !input.trim()}
              className="absolute bottom-2 right-2 h-8 w-8"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}