"use client";
import { Toast } from "@base-ui/react/toast";

/**
 * App-wide toast manager. Created outside React so any client component can
 * raise a toast without threading a context through — the `<Toaster />` mounted
 * in the app layout renders whatever is added here.
 */
export const toastManager = Toast.createToastManager();

/** Transient success confirmation (e.g. "Entry saved"). */
export function toastSuccess(title: string, description?: string): void {
  toastManager.add({ title, description, type: "success" });
}

/** Error notice the user should act on (e.g. a blocked save). */
export function toastError(title: string, description?: string): void {
  toastManager.add({ title, description, type: "error", priority: "high" });
}
