"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { shapesSelectors } from "@/redux/slices/shapes";
import { GeneratedUIShape } from "@/redux/slices/shapes";
import { useChatWindow } from "@/hooks/use-chat-window";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Chat redesign panel (spec §7.3): fixed to the right edge of the canvas,
 * keyed by the generated-ui shape whose header chat button opened it.
 * Streams full replacement HTML into the shape live via useChatWindow.
 */
export function ChatPanel({
  shapeId,
  projectId,
  onClose,
}: {
  shapeId: string;
  projectId: string;
  onClose: () => void;
}) {
  const { messages, isStreaming, send } = useChatWindow(shapeId, projectId);
  const shape = useAppSelector((state) =>
    shapesSelectors.selectById(state, shapeId)
  ) as GeneratedUIShape | undefined;

  const [draft, setDraft] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view (streams grow the last bubble).
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // The shape was deleted from under the panel — close it.
  useEffect(() => {
    if (!shape) onClose();
  }, [shape, onClose]);

  const handleSend = () => {
    const message = draft.trim();
    if (!message || isStreaming) return;
    setDraft("");
    void send(message);
  };

  return (
    <div className="absolute bottom-4 right-4 top-16 z-20 flex w-80 flex-col overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-xl backdrop-blur">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="truncate text-sm font-medium">
          {shape?.name ?? "Design chat"}
        </span>
        {isStreaming && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Describe a change — &ldquo;make the header dark&rdquo;,
              &ldquo;add a pricing section&rdquo; — and the design will be
              regenerated in place.
            </p>
          )}
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isLive =
              !isUser && isStreaming && message === messages[messages.length - 1];
            return (
              <div
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                  isUser
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted text-foreground"
                )}
              >
                {isUser ? (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                ) : isLive ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    streaming… {message.content.length > 0 && (
                      <span className="tabular-nums">
                        {Math.round(message.content.length / 1024)}kb
                      </span>
                    )}
                  </span>
                ) : (
                  // Assistant messages are full HTML documents — show a
                  // compact receipt instead of dumping markup in the bubble.
                  <span className="text-muted-foreground">
                    {message.content.startsWith("Error:")
                      ? message.content
                      : "Design updated ✓"}
                  </span>
                )}
              </div>
            );
          })}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center gap-2 border-t border-border/60 p-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation(); // canvas shortcuts must not fire while typing
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Describe your change…"
          className="h-8 text-xs"
          disabled={isStreaming}
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={isStreaming || draft.trim().length === 0}
          onClick={handleSend}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

