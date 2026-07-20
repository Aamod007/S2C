import {
  createSlice,
  createEntityAdapter,
  current,
  PayloadAction,
} from "@reduxjs/toolkit";
import { Shape, ToolType } from "@/types/shapes";

const shapesAdapter = createEntityAdapter<Shape>();

/** Undoable snapshot of the shape data (selection/tool are not undone). */
interface HistoryEntry {
  ids: string[];
  entities: Record<string, Shape>;
}

const HISTORY_LIMIT = 50;

interface ShapesExtraState {
  tool: ToolType;
  selectedIds: string[];
  selectedFrameCounter: number;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

const initialState = shapesAdapter.getInitialState<ShapesExtraState>({
  tool: "select",
  selectedIds: [],
  selectedFrameCounter: 0,
  past: [],
  future: [],
});

type ShapesSliceState = typeof initialState;

const takeSnapshot = (state: ShapesSliceState): HistoryEntry => {
  const s = current(state);
  return {
    ids: [...s.ids] as string[],
    entities: { ...s.entities } as Record<string, Shape>,
  };
};

const restore = (state: ShapesSliceState, entry: HistoryEntry) => {
  state.ids = entry.ids;
  state.entities = entry.entities;
  state.selectedIds = state.selectedIds.filter((id) => entry.entities[id]);
};

const pushPast = (state: ShapesSliceState) => {
  state.past.push(takeSnapshot(state));
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = []; // a new action invalidates the redo stack
};

const addWithHistory = (state: ShapesSliceState, action: PayloadAction<Shape>) => {
  pushPast(state);
  shapesAdapter.addOne(state, action.payload);
};

const shapesSlice = createSlice({
  name: "shapes",
  initialState,
  reducers: {
    // Shape CRUD. Mutating actions push an undo snapshot first (grouped
    // interactions like drag/resize checkpoint via pushHistory instead).
    addShape: (state, action: PayloadAction<Shape>) => {
      pushPast(state);
      shapesAdapter.addOne(state, action.payload);
    },
    addShapes: (state, action: PayloadAction<Shape[]>) => {
      pushPast(state);
      shapesAdapter.addMany(state, action.payload);
    },
    updateShape: shapesAdapter.updateOne,
    updateShapes: shapesAdapter.updateMany,
    // Removals also drop the removed ids from the selection — otherwise
    // erasing/deleting a selected shape leaves dead ids in selectedIds.
    removeShape: (state, action: PayloadAction<string>) => {
      pushPast(state);
      shapesAdapter.removeOne(state, action.payload);
      state.selectedIds = state.selectedIds.filter(
        (id) => id !== action.payload
      );
    },
    removeShapes: (state, action: PayloadAction<string[]>) => {
      pushPast(state);
      shapesAdapter.removeMany(state, action.payload);
      state.selectedIds = state.selectedIds.filter(
        (id) => !action.payload.includes(id)
      );
    },
    clearShapes: (state) => {
      pushPast(state);
      shapesAdapter.removeAll(state);
      state.selectedIds = [];
    },

    // Explicit undo checkpoint for grouped interactions (drag, resize,
    // sidebar edits) — dispatch BEFORE the first updateShape of the gesture.
    pushHistory: (state) => {
      pushPast(state);
    },

    undo: (state) => {
      const entry = state.past.pop();
      if (!entry) return;
      state.future.push(takeSnapshot(state));
      restore(state, entry);
    },
    redo: (state) => {
      const entry = state.future.pop();
      if (!entry) return;
      state.past.push(takeSnapshot(state));
      restore(state, entry);
    },

    // Typed shape adders (dispatching convenience)
    addFrame: (state, action: PayloadAction<Shape>) => {
      pushPast(state);
      shapesAdapter.addOne(state, action.payload);
      state.selectedFrameCounter += 1;
    },
    addRectangle: addWithHistory,
    addEllipse: addWithHistory,
    addLine: addWithHistory,
    addArrow: addWithHistory,
    addFreeDrawShape: addWithHistory,
    addText: addWithHistory,
    addGeneratedUI: addWithHistory,

    // Selection
    selectShape: (state, action: PayloadAction<string>) => {
      state.selectedIds = [action.payload];
    },
    toggleSelectShape: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      if (state.selectedIds.includes(id)) {
        state.selectedIds = state.selectedIds.filter((sid) => sid !== id);
      } else {
        state.selectedIds.push(id);
      }
    },
    clearSelection: (state) => {
      state.selectedIds = [];
    },

    // Tool
    setTool: (state, action: PayloadAction<ToolType>) => {
      state.tool = action.payload;
    },

    // Load project data (hydration — not user-undoable, clear history)
    loadProject: (state, action: PayloadAction<Shape[]>) => {
      shapesAdapter.setAll(state, action.payload);
      state.selectedIds = [];
      state.past = [];
      state.future = [];
    },
  },
});

// Scoped to any state that contains this slice under `shapes` (structurally
// matches RootState without importing it — store.ts is owned elsewhere).
export const shapesSelectors = shapesAdapter.getSelectors(
  (state: { shapes: ReturnType<typeof shapesSlice.getInitialState> }) => state.shapes
);

export const {
  addShape,
  addShapes,
  updateShape,
  updateShapes,
  removeShape,
  removeShapes,
  clearShapes,
  pushHistory,
  undo,
  redo,
  addFrame,
  addRectangle,
  addEllipse,
  addLine,
  addArrow,
  addFreeDrawShape,
  addText,
  addGeneratedUI,
  selectShape,
  toggleSelectShape,
  clearSelection,
  setTool,
  loadProject,
} = shapesSlice.actions;
export default shapesSlice.reducer;
