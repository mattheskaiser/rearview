"use client";
import { createContext, useContext, type ReactNode } from "react";

import { useReflectionStream } from "@/app/hooks/useReflectionStream";

/**
 * Hoists the reflection stream (retrieval + streamed answer + save) above the
 * Memories tabs so an in-flight AI search keeps running when the user switches
 * to the Journal tab and back. The `fetch` / `AbortController` live here, in a
 * component that is mounted for the whole page — never tied to whether the
 * `ReflectionPanel` itself is currently rendered (task: "AI searches must
 * continue running when switching tabs").
 */

type ReflectionValue = ReturnType<typeof useReflectionStream>;

const ReflectionContext = createContext<ReflectionValue | null>(null);

export const ReflectionProvider = ({ children }: { children: ReactNode }) => {
  const value = useReflectionStream();
  return (
    <ReflectionContext.Provider value={value}>
      {children}
    </ReflectionContext.Provider>
  );
};

export function useReflection(): ReflectionValue {
  const value = useContext(ReflectionContext);
  if (!value) {
    throw new Error("useReflection must be used within a ReflectionProvider");
  }
  return value;
}
