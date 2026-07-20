export type ShapeType =
  | "frame"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "free-draw"
  | "text"
  | "generated-ui";

export type ToolType =
  | "select"
  | "frame"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "pencil"
  | "text"
  | "eraser";

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface FrameShape extends BaseShape {
  type: "frame";
  label?: string;
}

export interface RectangleShape extends BaseShape {
  type: "rectangle";
  borderRadius?: number;
}

export interface EllipseShape extends BaseShape {
  type: "ellipse";
}

export interface LineShape extends BaseShape {
  type: "line";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface ArrowShape extends BaseShape {
  type: "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface FreeDrawShape extends BaseShape {
  type: "free-draw";
  points: { x: number; y: number }[];
}

export interface TextShape extends BaseShape {
  type: "text";
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  color?: string;
}

export interface GeneratedUIShape extends BaseShape {
  type: "generated-ui";
  htmlContent?: string;
  /** The generated HTML string (streamed in progressively; null/"" = pending). */
  uiSpecData?: string | null;
  sourceFrameId?: string;
  /** Display name for the card header ("Screen 1", derived page name, …). */
  name?: string;
  /** Streaming lifecycle for the DOM card (spec §7.2 step 6). */
  status?: "streaming" | "ready" | "error";
}

export type Shape =
  | FrameShape
  | RectangleShape
  | EllipseShape
  | LineShape
  | ArrowShape
  | FreeDrawShape
  | TextShape
  | GeneratedUIShape;
