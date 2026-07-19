import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  profileReducer,
  projectsReducer,
  shapesReducer,
  viewportReducer,
  chatReducer,
} from "./slices";
import { apis } from "./api";

const rootReducer = combineReducers({
  profile: profileReducer,
  projects: projectsReducer,
  shapes: shapesReducer,
  viewport: viewportReducer,
  chat: chatReducer,
  // Register all RTK Query reducers
  ...Object.fromEntries(apis.map((api) => [api.reducerPath, api.reducer])),
});

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(...apis.map((api) => api.middleware)),
    preloadedState: preloadedState as any,
  });
}

// Types
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
