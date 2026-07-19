import {
  createSlice,
  createEntityAdapter,
  PayloadAction,
} from "@reduxjs/toolkit";
import { Shape, ToolType } from "@/types/shapes";

const shapesAdapter = createEntityAdapter<Shape>();

interface ShapesExtraState {
  tool: ToolType;
  selectedIds: string[];
  selectedFrameCounter: number;
}

const initialState = shapesAdapter.getInitialState<ShapesExtraState>({
  tool: "select",
  selectedIds: [],
  selectedFrameCounter: 0,
});

const shapesSlice = createSlice({
  name: "shapes",
  initialState,
  reducers: {
    // Shape CRUD
    addShape: shapesAdapter.addOne,
    addShapes: shapesAdapter.addMany,
    updateShape: shapesAdapter.updateOne,
    removeShape: shapesAdapter.removeOne,
    removeShapes: shapesAdapter.removeMany,
    clearShapes: shapesAdapter.removeAll,

    // Typed shape adders (dispatching convenience)
    addFrame: (state, action: PayloadAction<Shape>) => {
      shapesAdapter.addOne(state, action.payload);
      state.selectedFrameCounter += 1;
    },
    addRectangle: shapesAdapter.addOne,
    addEllipse: shapesAdapter.addOne,
    addLine: shapesAdapter.addOne,
    addArrow: shapesAdapter.addOne,
    addFreeDrawShape: shapesAdapter.addOne,
    addText: shapesAdapter.addOne,
    addGeneratedUI: shapesAdapter.addOne,

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

    // Load project data
    loadProject: (state, action: PayloadAction<Shape[]>) => {
      shapesAdapter.setAll(state, action.payload);
      state.selectedIds = [];
    },
  },
});

export const shapesSelectors = shapesAdapter.getSelectors();

export const {
  addShape,
  addShapes,
  updateShape,
  removeShape,
  removeShapes,
  clearShapes,
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
