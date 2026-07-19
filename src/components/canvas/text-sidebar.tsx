"use client";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { shapesSelectors, updateShape } from "@/redux/slices/shapes";
import { TextShape } from "@/types/shapes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bold, Italic } from "lucide-react";
import { cn } from "@/lib/utils";

const FONT_FAMILIES = [
  { value: "sans-serif", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Mono" },
];

const COLOR_SWATCHES = [
  "#e4e4e7", // zinc-200 (default on dark canvas)
  "#ffffff",
  "#ef4444", // red
  "#f59e0b", // amber
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
];

/**
 * Floating panel shown when exactly one text shape is selected (spec 4f).
 * All controls dispatch updateShape directly.
 */
export function TextSidebar() {
  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector((state) => state.shapes.selectedIds);
  const shape = useAppSelector((state) =>
    selectedIds.length === 1
      ? shapesSelectors.selectById(state, selectedIds[0])
      : undefined
  );

  if (!shape || shape.type !== "text") return null;
  const text = shape as TextShape;

  const set = (changes: Partial<TextShape>) =>
    dispatch(updateShape({ id: text.id, changes }));

  const isBold = text.fontWeight === "bold";
  const isItalic = text.fontStyle === "italic";

  return (
    <div className="absolute right-4 top-16 z-10 flex w-52 flex-col gap-3 rounded-lg border border-border/50 bg-background/80 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Font size</Label>
        <Input
          type="number"
          min={4}
          max={200}
          value={text.fontSize ?? 16}
          onChange={(e) => {
            const size = Number(e.target.value);
            if (Number.isFinite(size) && size > 0) set({ fontSize: size });
          }}
          className="h-8"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Font family</Label>
        <Select
          value={text.fontFamily ?? "sans-serif"}
          onValueChange={(value) => set({ fontFamily: value })}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Style</Label>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => set({ fontWeight: isBold ? "normal" : "bold" })}
            className={cn(
              "h-8 w-8",
              isBold && "bg-primary/20 text-primary hover:bg-primary/30"
            )}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => set({ fontStyle: isItalic ? "normal" : "italic" })}
            className={cn(
              "h-8 w-8",
              isItalic && "bg-primary/20 text-primary hover:bg-primary/30"
            )}
          >
            <Italic className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Color</Label>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Set color ${color}`}
              onClick={() => set({ color })}
              className={cn(
                "h-6 w-6 rounded-full border border-border/60 transition-transform hover:scale-110",
                (text.color ?? "#e4e4e7") === color &&
                  "ring-2 ring-primary ring-offset-1 ring-offset-background"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
