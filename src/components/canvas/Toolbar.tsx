"use client";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setTool } from "@/redux/slices/shapes";
import { ToolType } from "@/types/shapes";
import { Button } from "@/components/ui/button";
import {
  MousePointer2,
  Square,
  Circle,
  Frame,
  Pencil,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLS: { id: ToolType; icon: React.ElementType; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select (V)" },
  { id: "frame", icon: Frame, label: "Frame (F)" },
  { id: "rectangle", icon: Square, label: "Rectangle (R)" },
  { id: "ellipse", icon: Circle, label: "Ellipse (O)" },
  { id: "pencil", icon: Pencil, label: "Pencil (P)" },
  { id: "text", icon: Type, label: "Text (T)" },
];

export function Toolbar() {
  const dispatch = useAppDispatch();
  const activeTool = useAppSelector((state) => state.shapes.tool);

  return (
    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border/50 bg-background/80 p-1 shadow-sm backdrop-blur">
      {TOOLS.map((tool) => (
        <Button
          key={tool.id}
          variant="ghost"
          size="icon"
          title={tool.label}
          onClick={() => dispatch(setTool(tool.id))}
          className={cn(
            "h-8 w-8 rounded-md transition-colors",
            activeTool === tool.id &&
              "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary"
          )}
        >
          <tool.icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}
