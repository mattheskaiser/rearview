"use client";
import type { ReactNode } from "react";

import { ReflectionProvider } from "@/app/hooks/reflection-context";

/**
 * Wraps every `/memories` route — the Reflect + Journal Archive index and each
 * `/memories/journal/[year]` page — in the reflection stream provider. The App
 * Router keeps a layout mounted while navigating between its child routes, so
 * an in-flight AI search keeps running (and its evidence / answer survive)
 * while the user steps into the Journal Archive and back.
 */
export default function MemoriesLayout({ children }: { children: ReactNode }) {
  return <ReflectionProvider>{children}</ReflectionProvider>;
}
