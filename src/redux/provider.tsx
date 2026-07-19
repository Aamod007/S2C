"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, AppStore, RootState } from "./store";

interface StoreProviderProps {
  children: React.ReactNode;
  preloadedState?: Partial<RootState>;
}

export function StoreProvider({ children, preloadedState }: StoreProviderProps) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore(preloadedState);
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
