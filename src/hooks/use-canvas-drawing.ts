import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  addArrow,
  addEllipse,
  addFrame,
  addFreeDrawShape,
  addLine,
  addRectangle,
  addShapes,
  addText,
  clearSelection,
  pushHistory,
  redo,
  removeShape,
  removeShapes,
  selectShape,
  setTool,
  shapesSelectors,
  toggleSelectShape,
  undo,
  updateShape,
  updateShapes,
} from "@/redux/slices/shapes";
import { panBy, screenToWorld } from "@/redux/slices/viewport";
import { Shape } from "@/types/shapes";
import {
  getAnchorForCorner,
  getHandleAtPoint,
  getShapeAtPoint,
  getShapeBounds,
  boundsFromAnchor,
  resizeShape,
  Bounds,
  HandleCorner,
} from "@/lib/canvas-hit-test";
import { v4 as uuidv4 } from "uuid";

type InteractionMode =
  | "idle"
  | "drawing"
  | "moving"
  | "resizing"
  | "panning"
  | "erasing";

type MoveBaseline =
  | { kind: "bounds"; x: number; y: number }
  | { kind: "points"; x: number; y: number; points: { x: number; y: number }[] }
  | {
      kind: "endpoints";
      x: number;
      y: number;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    };

interface ResizeData {
  shapeId: string;
  corner: HandleCorner;
  anchor: { x: number; y: number };
  initialBounds: Bounds;
  baseline: Shape;
}

// Screen-px dead zone before a click on a shape turns into a drag-move.
const MOVE_DEAD_ZONE = 3;
// World-px minimum distance between consecutive free-draw points.
const FREE_DRAW_MIN_DIST = 1;
// World-px minimum length before a line/arrow commit (prevents click-commits).
const LINE_MIN_LENGTH = 2;

// Snap an endpoint to the nearest 15° increment around `start` (shift-held).
const snapToAngle = (
  start: { x: number; y: number },
  end: { x: number; y: number }
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return end;
  const step = Math.PI / 12; // 15°
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: start.x + len * Math.cos(angle), y: start.y + len * Math.sin(angle) };
};

export function useCanvasDrawing(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draftShapeRef: React.MutableRefObject<Shape | null>
) {
  const dispatch = useAppDispatch();

  // Redux state, mirrored into refs so the (once-attached) native event
  // handlers always see fresh values without re-subscribing mid-gesture.
  const tool = useAppSelector((state) => state.shapes.tool);
  const selectedIds = useAppSelector((state) => state.shapes.selectedIds);
  const shapes = useAppSelector(shapesSelectors.selectAll);
  const viewport = useAppSelector((state) => state.viewport);

  const toolRef = useRef(tool);
  const selectedIdsRef = useRef(selectedIds);
  const shapesRef = useRef(shapes);
  const viewportRef = useRef(viewport);
  toolRef.current = tool;
  selectedIdsRef.current = selectedIds;
  shapesRef.current = shapes;
  viewportRef.current = viewport;

  // 60fps interaction state — refs only, never React state (spec §6.2).
  const modeRef = useRef<InteractionMode>("idle");
  const spacePressedRef = useRef(false);
  const shiftPressedRef = useRef(false); // live shift state for angle snapping
  const startPointRef = useRef<{ x: number; y: number } | null>(null); // world
  const startClientRef = useRef<{ x: number; y: number } | null>(null); // canvas-local px
  const lastClientRef = useRef<{ x: number; y: number } | null>(null); // for pan deltas
  const pendingClientRef = useRef<{ x: number; y: number } | null>(null); // latest pointer, rAF-consumed
  const freeDrawPointsRef = useRef<{ x: number; y: number }[]>([]); // world, absolute
  const moveStartedRef = useRef(false); // dead-zone passed
  const initialShapePositionsRef = useRef<Map<string, MoveBaseline>>(new Map());
  const resizeDataRef = useRef<ResizeData | null>(null);
  const erasedShapesRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number>(0);
  // Copied shapes (deep clones) for Ctrl+C/V/D — module-local, not OS clipboard.
  const clipboardRef = useRef<Shape[]>([]);

  // Text editing is rare + needs a DOM overlay, so it's real React state.
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const editingTextIdRef = useRef<string | null>(null);
  editingTextIdRef.current = editingTextId;

  // forceRender: bump only when a ref-based value needs to hit the DOM
  // (here: the cursor, which depends on spacePressedRef / panning mode).
  const [, setRenderCounter] = useState(0);
  const forceRender = useCallback(() => setRenderCounter((c) => c + 1), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getLocalPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const getWorldPoint = (local: { x: number; y: number }) => {
      const { scale, translate } = viewportRef.current;
      return screenToWorld(local.x, local.y, scale, translate);
    };

    const captureMoveBaselines = (ids: string[]) => {
      const map = new Map<string, MoveBaseline>();
      for (const id of ids) {
        const shape = shapesRef.current.find((s) => s.id === id);
        if (!shape) continue;
        if (shape.type === "free-draw") {
          map.set(id, {
            kind: "points",
            x: shape.x,
            y: shape.y,
            points: shape.points.map((p) => ({ x: p.x, y: p.y })),
          });
        } else if (shape.type === "line" || shape.type === "arrow") {
          map.set(id, {
            kind: "endpoints",
            x: shape.x,
            y: shape.y,
            startX: shape.startX,
            startY: shape.startY,
            endX: shape.endX,
            endY: shape.endY,
          });
        } else {
          map.set(id, { kind: "bounds", x: shape.x, y: shape.y });
        }
      }
      initialShapePositionsRef.current = map;
    };

    const eraseAtPoint = (world: { x: number; y: number }) => {
      const hit = getShapeAtPoint(
        shapesRef.current.filter((s) => !erasedShapesRef.current.has(s.id)),
        world.x,
        world.y,
        viewportRef.current.scale
      );
      if (hit && !erasedShapesRef.current.has(hit.id)) {
        erasedShapesRef.current.add(hit.id);
        dispatch(removeShape(hit.id));
      }
    };

    // ---- rAF-throttled pointer-move processing ----
    const processFrame = () => {
      animationFrameRef.current = 0;
      const local = pendingClientRef.current;
      if (!local) return;
      const mode = modeRef.current;

      if (mode === "panning") {
        const last = lastClientRef.current;
        if (last) {
          const dx = local.x - last.x;
          const dy = local.y - last.y;
          if (dx !== 0 || dy !== 0) dispatch(panBy({ dx, dy }));
        }
        lastClientRef.current = local;
        return;
      }

      const world = getWorldPoint(local);

      if (mode === "drawing") {
        const start = startPointRef.current;
        const draft = draftShapeRef.current;
        if (!start || !draft) return;

        if (draft.type === "line" || draft.type === "arrow") {
          const end = shiftPressedRef.current
            ? snapToAngle(start, world)
            : world;
          draftShapeRef.current = {
            ...draft,
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
          };
          return;
        }

        if (draft.type === "free-draw") {
          const pts = freeDrawPointsRef.current;
          const last = pts[pts.length - 1];
          if (
            !last ||
            Math.hypot(world.x - last.x, world.y - last.y) >= FREE_DRAW_MIN_DIST
          ) {
            pts.push(world);
            // New array identity each frame so the render loop sees a stable
            // snapshot; the points themselves stay absolute world-space.
            draftShapeRef.current = { ...draft, points: pts.slice() };
          }
          return;
        }

        draftShapeRef.current = {
          ...draft,
          x: Math.min(start.x, world.x),
          y: Math.min(start.y, world.y),
          width: Math.abs(world.x - start.x),
          height: Math.abs(world.y - start.y),
        };
        return;
      }

      if (mode === "moving") {
        const start = startPointRef.current;
        const startClient = startClientRef.current;
        if (!start || !startClient) return;
        if (!moveStartedRef.current) {
          if (
            Math.hypot(local.x - startClient.x, local.y - startClient.y) <
            MOVE_DEAD_ZONE
          ) {
            return;
          }
          moveStartedRef.current = true;
          dispatch(pushHistory()); // one undo step per move gesture
        }
        const dx = world.x - start.x;
        const dy = world.y - start.y;
        const updates: { id: string; changes: Partial<Shape> }[] = [];
        initialShapePositionsRef.current.forEach((base, id) => {
          if (base.kind === "points") {
            updates.push({
              id,
              changes: {
                x: base.x + dx,
                y: base.y + dy,
                points: base.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
              } as Partial<Shape>,
            });
          } else if (base.kind === "endpoints") {
            updates.push({
              id,
              changes: {
                x: base.x + dx,
                y: base.y + dy,
                startX: base.startX + dx,
                startY: base.startY + dy,
                endX: base.endX + dx,
                endY: base.endY + dy,
              } as Partial<Shape>,
            });
          } else {
            updates.push({
              id,
              changes: { x: base.x + dx, y: base.y + dy },
            });
          }
        });
        if (updates.length > 0) dispatch(updateShapes(updates));
        return;
      }

      if (mode === "resizing") {
        const data = resizeDataRef.current;
        if (!data) return;
        const newBounds = boundsFromAnchor(data.anchor, world.x, world.y);
        dispatch(
          updateShape({
            id: data.shapeId,
            changes: resizeShape(data.baseline, data.initialBounds, newBounds),
          })
        );
        return;
      }

      if (mode === "erasing") {
        eraseAtPoint(world);
      }
    };

    const scheduleFrame = () => {
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    // ---- pointer handlers ----
    const handlePointerDown = (e: PointerEvent) => {
      // No multi-touch support yet: a second finger mid-gesture would
      // overwrite mode/start refs and corrupt the in-progress interaction.
      if (!e.isPrimary) return;
      const local = getLocalPoint(e);
      const world = getWorldPoint(local);
      const currentTool = toolRef.current;

      // Middle-mouse or space-held: temporary pan override on any tool.
      if (e.button === 1 || (e.button === 0 && spacePressedRef.current)) {
        e.preventDefault();
        modeRef.current = "panning";
        lastClientRef.current = local;
        canvas.setPointerCapture(e.pointerId);
        forceRender(); // cursor → grabbing
        return;
      }

      if (e.button !== 0) return;

      if (currentTool === "eraser") {
        modeRef.current = "erasing";
        erasedShapesRef.current = new Set();
        canvas.setPointerCapture(e.pointerId);
        eraseAtPoint(world);
        return;
      }

      if (currentTool === "select") {
        const scale = viewportRef.current.scale;

        // 1. Resize handle on the single selected shape?
        if (selectedIdsRef.current.length === 1) {
          const selected = shapesRef.current.find(
            (s) => s.id === selectedIdsRef.current[0]
          );
          if (selected) {
            const bounds = getShapeBounds(selected);
            const corner = getHandleAtPoint(bounds, world.x, world.y, scale);
            if (corner) {
              modeRef.current = "resizing";
              resizeDataRef.current = {
                shapeId: selected.id,
                corner,
                anchor: getAnchorForCorner(bounds, corner),
                initialBounds: bounds,
                baseline: JSON.parse(JSON.stringify(selected)) as Shape,
              };
              dispatch(pushHistory()); // one undo step per resize gesture
              canvas.setPointerCapture(e.pointerId);
              return;
            }
          }
        }

        // 2. Shape body?
        const hit = getShapeAtPoint(shapesRef.current, world.x, world.y, scale);
        if (hit) {
          if (e.shiftKey) {
            // Toggle membership; no drag on shift-click.
            dispatch(toggleSelectShape(hit.id));
            return;
          }
          const effectiveIds = selectedIdsRef.current.includes(hit.id)
            ? selectedIdsRef.current // keep multi-selection for group move
            : [hit.id];
          if (!selectedIdsRef.current.includes(hit.id)) {
            dispatch(selectShape(hit.id));
          }
          modeRef.current = "moving";
          moveStartedRef.current = false;
          startPointRef.current = world;
          startClientRef.current = local;
          captureMoveBaselines(effectiveIds);
          canvas.setPointerCapture(e.pointerId);
          return;
        }

        // 3. Empty space: clear selection, drag pans.
        if (!e.shiftKey) dispatch(clearSelection());
        modeRef.current = "panning";
        lastClientRef.current = local;
        canvas.setPointerCapture(e.pointerId);
        forceRender();
        return;
      }

      if (currentTool === "text") {
        // Single click places a text shape, switches to select, and opens
        // the edit overlay immediately (spec 4f).
        // preventDefault stops the canvas (tabIndex=0) from taking focus on
        // this pointerdown/click — otherwise it immediately blurs the just-
        // mounted edit input, committing empty text and removing the shape
        // (the "text tool does nothing" bug).
        e.preventDefault();
        const id = uuidv4();
        dispatch(
          addText({
            id,
            type: "text",
            x: world.x,
            y: world.y,
            width: 0,
            height: 0,
            text: "",
            fontSize: 16,
            fontFamily: "sans-serif",
            color: "#e4e4e7",
          } as Shape)
        );
        dispatch(setTool("select"));
        dispatch(selectShape(id));
        setEditingTextId(id);
        return;
      }

      // Draw tools (draft-commit flow).
      if (currentTool === "line" || currentTool === "arrow") {
        modeRef.current = "drawing";
        startPointRef.current = world;
        canvas.setPointerCapture(e.pointerId);

        draftShapeRef.current = {
          id: uuidv4(),
          type: currentTool,
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          startX: world.x,
          startY: world.y,
          endX: world.x,
          endY: world.y,
          stroke: "#ffffff",
          strokeWidth: 2,
        } as Shape;

        dispatch(clearSelection());
        return;
      }

      if (currentTool === "pencil") {
        modeRef.current = "drawing";
        startPointRef.current = world;
        canvas.setPointerCapture(e.pointerId);

        freeDrawPointsRef.current = [world];
        draftShapeRef.current = {
          id: uuidv4(),
          type: "free-draw",
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          points: [world],
          stroke: "#ffffff",
          strokeWidth: 2,
        } as Shape;

        dispatch(clearSelection());
        return;
      }

      if (
        currentTool === "rectangle" ||
        currentTool === "ellipse" ||
        currentTool === "frame"
      ) {
        modeRef.current = "drawing";
        startPointRef.current = world;
        canvas.setPointerCapture(e.pointerId);

        draftShapeRef.current = {
          id: uuidv4(),
          type: currentTool,
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: currentTool === "frame" ? "#888888" : "#ffffff",
          strokeWidth: currentTool === "frame" ? 1 : 2,
        } as Shape;

        dispatch(clearSelection());
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      if (modeRef.current === "idle") return;
      pendingClientRef.current = getLocalPoint(e);
      scheduleFrame();
    };

    const finalizeDrawing = () => {
      const shape = draftShapeRef.current;
      draftShapeRef.current = null;
      if (!shape) return;

      if (shape.type === "line" || shape.type === "arrow") {
        const length = Math.hypot(
          shape.endX - shape.startX,
          shape.endY - shape.startY
        );
        if (length > LINE_MIN_LENGTH) {
          dispatch(shape.type === "line" ? addLine(shape) : addArrow(shape));
        }
        return;
      }

      if (shape.type === "free-draw") {
        const pts = freeDrawPointsRef.current;
        freeDrawPointsRef.current = [];
        if (pts.length < 2) return; // a click, not a stroke
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        dispatch(
          addFreeDrawShape({
            ...shape,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            points: pts,
          })
        );
        return;
      }

      // Minimum size threshold prevents accidental click-commits.
      if (shape.width > 2 || shape.height > 2) {
        if (shape.type === "rectangle") dispatch(addRectangle(shape));
        else if (shape.type === "ellipse") dispatch(addEllipse(shape));
        else if (shape.type === "frame") dispatch(addFrame(shape));
      }
    };

    const endInteraction = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      if (modeRef.current === "idle") return;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      // Flush any pending rAF work so the last pointer position commits.
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
        processFrame();
      }
      const mode = modeRef.current;
      modeRef.current = "idle";

      if (mode === "drawing") finalizeDrawing();
      if (mode === "panning") forceRender(); // cursor back

      startPointRef.current = null;
      startClientRef.current = null;
      lastClientRef.current = null;
      pendingClientRef.current = null;
      freeDrawPointsRef.current = [];
      moveStartedRef.current = false;
      initialShapePositionsRef.current = new Map();
      resizeDataRef.current = null;
      erasedShapesRef.current = new Set();
    };

    // Double-click a text shape with the select tool re-enters edit mode.
    const handleDoubleClick = (e: MouseEvent) => {
      if (toolRef.current !== "select") return;
      const rect = canvas.getBoundingClientRect();
      const world = getWorldPoint({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      const hit = getShapeAtPoint(
        shapesRef.current,
        world.x,
        world.y,
        viewportRef.current.scale
      );
      if (hit && hit.type === "text") {
        dispatch(selectShape(hit.id));
        setEditingTextId(hit.id);
      }
    };

    // ---- keyboard: spacebar = temporary pan override ----
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      );
    };

    // Tool keyboard shortcuts (single letters, no modifiers).
    const TOOL_SHORTCUTS: Record<string, Parameters<typeof setTool>[0]> = {
      v: "select",
      f: "frame",
      r: "rectangle",
      o: "ellipse",
      p: "pencil",
      l: "line",
      a: "arrow",
      t: "text",
      e: "eraser",
    };

    // Deep-clone shapes with fresh ids, offset so pastes don't stack exactly.
    const PASTE_OFFSET = 16;
    const cloneShapes = (sources: Shape[]): Shape[] =>
      sources.map((s) => {
        const clone = JSON.parse(JSON.stringify(s)) as Shape;
        clone.id = uuidv4();
        clone.x += PASTE_OFFSET;
        clone.y += PASTE_OFFSET;
        if (clone.type === "free-draw") {
          clone.points = clone.points.map((p) => ({
            x: p.x + PASTE_OFFSET,
            y: p.y + PASTE_OFFSET,
          }));
        } else if (clone.type === "line" || clone.type === "arrow") {
          clone.startX += PASTE_OFFSET;
          clone.startY += PASTE_OFFSET;
          clone.endX += PASTE_OFFSET;
          clone.endY += PASTE_OFFSET;
        }
        return clone;
      });

    const copySelection = () => {
      const selected = shapesRef.current.filter((s) =>
        selectedIdsRef.current.includes(s.id)
      );
      if (selected.length > 0) {
        clipboardRef.current = JSON.parse(JSON.stringify(selected));
      }
    };

    const pasteShapes = (sources: Shape[]) => {
      if (sources.length === 0) return;
      const clones = cloneShapes(sources);
      dispatch(addShapes(clones));
      // Select the fresh clones so a follow-up drag moves them.
      dispatch(clearSelection());
      clones.forEach((c, i) =>
        dispatch(i === 0 ? selectShape(c.id) : toggleSelectShape(c.id))
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftPressedRef.current = true;
      // While editing text (or typing anywhere), canvas shortcuts must not fire.
      if (isTypingTarget(e.target) || editingTextIdRef.current) return;

      // Undo/redo/copy/paste/duplicate/select-all (Excalidraw-style).
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "z") {
          e.preventDefault();
          dispatch(e.shiftKey ? redo() : undo());
          return;
        }
        if (key === "y") {
          e.preventDefault();
          dispatch(redo());
          return;
        }
        if (key === "c") {
          copySelection();
          return; // don't preventDefault — harmless, keeps devtools copy working
        }
        if (key === "x") {
          if (selectedIdsRef.current.length > 0) {
            e.preventDefault();
            copySelection();
            dispatch(removeShapes(selectedIdsRef.current));
          }
          return;
        }
        if (key === "v") {
          e.preventDefault();
          pasteShapes(clipboardRef.current);
          return;
        }
        if (key === "d") {
          e.preventDefault();
          pasteShapes(
            shapesRef.current.filter((s) =>
              selectedIdsRef.current.includes(s.id)
            )
          );
          return;
        }
        if (key === "a") {
          e.preventDefault();
          dispatch(clearSelection());
          shapesRef.current.forEach((s, i) =>
            dispatch(i === 0 ? selectShape(s.id) : toggleSelectShape(s.id))
          );
          return;
        }
        return; // other Ctrl/Cmd combos: leave to the browser
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (!spacePressedRef.current) {
          spacePressedRef.current = true;
          forceRender(); // cursor → grab
        }
        return;
      }

      // Delete/Backspace removes the current selection.
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIdsRef.current.length > 0) {
          e.preventDefault();
          dispatch(removeShapes(selectedIdsRef.current));
          dispatch(clearSelection());
        }
        return;
      }

      // Arrow keys nudge the selection (Shift = 10px steps).
      if (
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight") &&
        selectedIdsRef.current.length > 0
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        dispatch(pushHistory());
        const updates = shapesRef.current
          .filter((s) => selectedIdsRef.current.includes(s.id))
          .map((s) => {
            const changes: Partial<Shape> = { x: s.x + dx, y: s.y + dy };
            if (s.type === "free-draw") {
              (changes as Partial<Shape> & { points: { x: number; y: number }[] }).points =
                s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
            } else if (s.type === "line" || s.type === "arrow") {
              Object.assign(changes, {
                startX: s.startX + dx,
                startY: s.startY + dy,
                endX: s.endX + dx,
                endY: s.endY + dy,
              });
            }
            return { id: s.id, changes };
          });
        dispatch(updateShapes(updates));
        return;
      }

      if (e.altKey) return;
      const nextTool = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (nextTool && modeRef.current === "idle") {
        dispatch(setTool(nextTool));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftPressedRef.current = false;
      if (e.code === "Space") {
        spacePressedRef.current = false;
        forceRender();
      }
    };

    // Focus loss (Alt+Tab, dev tools…) swallows keyup — clear held-key state
    // so the canvas isn't stuck in pan/snap mode when focus returns.
    const handleWindowBlur = () => {
      if (spacePressedRef.current || shiftPressedRef.current) {
        spacePressedRef.current = false;
        shiftPressedRef.current = false;
        forceRender();
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", endInteraction);
    canvas.addEventListener("pointercancel", endInteraction);
    canvas.addEventListener("dblclick", handleDoubleClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", endInteraction);
      canvas.removeEventListener("pointercancel", endInteraction);
      canvas.removeEventListener("dblclick", handleDoubleClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        // Reset the scheduling guard too — a stale id would permanently
        // block scheduleFrame if this effect ever re-runs (HMR).
        animationFrameRef.current = 0;
      }
    };
    // Handlers read all fast-changing state through refs — attach once.
  }, [canvasRef, dispatch, draftShapeRef, forceRender]);

  // Cursor derived from tool + ref-based interaction state (forceRender
  // bumps when the ref side changes).
  const cursor =
    modeRef.current === "panning"
      ? "grabbing"
      : spacePressedRef.current
        ? "grab"
        : tool === "select"
          ? "default"
          : tool === "text"
            ? "text"
            : "crosshair";

  return { cursor, editingTextId, setEditingTextId };
}
