import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ViewportState {
  scale: number;
  translate: { x: number; y: number };
}

const initialState: ViewportState = {
  scale: 1,
  translate: { x: 0, y: 0 },
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

export const viewportSlice = createSlice({
  name: "viewport",
  initialState,
  reducers: {
    wheelPan: (
      state,
      action: PayloadAction<{ dx: number; dy: number }>
    ) => {
      state.translate.x -= action.payload.dx;
      state.translate.y -= action.payload.dy;
    },
    wheelZoom: (
      state,
      action: PayloadAction<{ deltaY: number; clientX: number; clientY: number }>
    ) => {
      const { deltaY, clientX, clientY } = action.payload;
      const zoomFactor = 0.999 ** deltaY;
      
      const newScale = Math.min(Math.max(state.scale * zoomFactor, MIN_SCALE), MAX_SCALE);
      
      // Calculate how much the scale changed to adjust translation
      // so we zoom in/out relative to the mouse cursor
      const scaleRatio = newScale / state.scale;
      
      state.translate = {
        x: clientX - (clientX - state.translate.x) * scaleRatio,
        y: clientY - (clientY - state.translate.y) * scaleRatio,
      };
      
      state.scale = newScale;
    },
    setViewport: (
      state,
      action: PayloadAction<ViewportState>
    ) => {
      state.scale = action.payload.scale;
      state.translate = action.payload.translate;
    },
    resetViewport: () => initialState,
  },
});

export const { wheelPan, wheelZoom, setViewport, resetViewport } = viewportSlice.actions;
export default viewportSlice.reducer;

// Pure utility functions for coordinate conversions
export const screenToWorld = (
  clientX: number,
  clientY: number,
  scale: number,
  translate: { x: number; y: number }
) => {
  return {
    x: (clientX - translate.x) / scale,
    y: (clientY - translate.y) / scale,
  };
};

export const worldToScreen = (
  worldX: number,
  worldY: number,
  scale: number,
  translate: { x: number; y: number }
) => {
  return {
    x: worldX * scale + translate.x,
    y: worldY * scale + translate.y,
  };
};
