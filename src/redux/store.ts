import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  profileReducer,
  projectsReducer,
  shapesReducer,
  viewportReducer,
  chatReducer,
} from "./slices";
import {
  apis,
  projectApi,
  styleGuideApi,
  billingApi,
  generationApi,
} from "./api";

// Register RTK Query reducers explicitly (not via Object.fromEntries) so their
// types are preserved in RootState — otherwise the api middleware doesn't typecheck.
const rootReducer = combineReducers({
  profile: profileReducer,
  projects: projectsReducer,
  shapes: shapesReducer,
  viewport: viewportReducer,
  chat: chatReducer,
  [projectApi.reducerPath]: projectApi.reducer,
  [styleGuideApi.reducerPath]: styleGuideApi.reducer,
  [billingApi.reducerPath]: billingApi.reducer,
  [generationApi.reducerPath]: generationApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(...apis.map((api) => api.middleware)),
    preloadedState,
  });
}

// Types
export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
