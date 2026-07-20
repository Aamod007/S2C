"use client";

import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setTool } from "@/redux/slices/shapes";
import { ToolType } from "@/types/shapes";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import {
  MousePointer2,
  Square,
  Circle,
  Frame,
  Pencil,
  Type,
  Minus,
  MoveUpRight,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLS: {
  id: ToolType;
  icon: React.ElementType;
  label: string;
  shortcut: string;
}[] = [
  { id: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
  { id: "frame", icon: Frame, label: "Frame", shortcut: "F" },
  { id: "rectangle", icon: Square, label: "Rectangle", shortcut: "R" },
  { id: "ellipse", icon: Circle, label: "Ellipse", shortcut: "O" },
  { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "P" },
  { id: "line", icon: Minus, label: "Line", shortcut: "L" },
  { id: "arrow", icon: MoveUpRight, label: "Arrow", shortcut: "A" },
  { id: "text", icon: Type, label: "Text", shortcut: "T" },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
];

export function Toolbar() {
  const dispatch = useAppDispatch();
  const activeTool = useAppSelector((state) => state.shapes.tool);

  return (
    <TooltipProvider>
      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border/50 bg-background/80 p-1 shadow-sm backdrop-blur">
        {TOOLS.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch(setTool(tool.id))}
                className={cn(
                  "h-8 w-8 rounded-md transition-colors",
                  activeTool === tool.id &&
                    "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary"
                )}
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {tool.label} <Kbd>{tool.shortcut}</Kbd>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
