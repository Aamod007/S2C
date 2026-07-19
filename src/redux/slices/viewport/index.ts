import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ViewportState {
  scale: number;
  translateX: number;
  translateY: number;
}

const initialState: ViewportState = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

const viewportSlice = createSlice({
  name: "viewport",
  initialState,
  reducers: {
    wheelZoom: (
      state,
      action: PayloadAction<{
        deltaY: number;
        clientX: number;
        clientY: number;
        canvasLeft: number;
        canvasTop: number;
      }>
    ) => {
      const { deltaY, clientX, clientY, canvasLeft, canvasTop } =
        action.payload;

      const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, state.scale * zoomFactor)
      );

      // Zoom towards cursor position
      const mouseX = clientX - canvasLeft;
      const mouseY = clientY - canvasTop;

      state.translateX =
        mouseX - (mouseX - state.translateX) * (newScale / state.scale);
      state.translateY =
        mouseY - (mouseY - state.translateY) * (newScale / state.scale);
      state.scale = newScale;
    },

    wheelPan: (
      state,
      action: PayloadAction<{ deltaX: number; deltaY: number }>
    ) => {
      state.translateX -= action.payload.deltaX;
      state.translateY -= action.payload.deltaY;
    },

    panStart: () => {
      // Pan start is tracked via refs, not state
    },
    panMove: (
      state,
      action: PayloadAction<{ deltaX: number; deltaY: number }>
    ) => {
      state.translateX += action.payload.deltaX;
      state.translateY += action.payload.deltaY;
    },
    panEnd: () => {
      // No-op, cleanup handled in refs
    },

    setViewport: (
      state,
      action: PayloadAction<{
        scale: number;
        translateX: number;
        translateY: number;
      }>
    ) => {
      state.scale = action.payload.scale;
      state.translateX = action.payload.translateX;
      state.translateY = action.payload.translateY;
    },

    resetViewport: () => initialState,
  },
});

// ── Selectors (pure functions) ───────────────────────────────

export function screenToWorld(
  screenX: number,
  screenY: number,
  scale: number,
  translateX: number,
  translateY: number
) {
  return {
    x: (screenX - translateX) / scale,
    y: (screenY - translateY) / scale,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  scale: number,
  translateX: number,
  translateY: number
) {
  return {
    x: worldX * scale + translateX,
    y: worldY * scale + translateY,
  };
}

export const {
  wheelZoom,
  wheelPan,
  panStart,
  panMove,
  panEnd,
  setViewport,
  resetViewport,
} = viewportSlice.actions;
export default viewportSlice.reducer;
