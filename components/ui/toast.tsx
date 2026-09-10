"use client";
import { Toast } from "@base-ui/react/toast";

import { toastManager } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

/**
 * App-wide toast outlet. Mounted once in the authenticated layout; components
 * raise toasts through the shared `toastManager` (see `lib/ui/toast.ts`).
 */
export const Toaster = () => (
  <Toast.Provider toastManager={toastManager}>
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 bottom-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  </Toast.Provider>
);

const ToastList = () => {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className={cn(
        "rounded-lg border p-3 text-sm shadow-md ring-1 ring-foreground/10",
        "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
        "transition-transform duration-200",
        toast.type === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-popover text-popover-foreground",
      )}
    >
      <Toast.Title className="font-medium" />
      <Toast.Description className="text-muted-foreground" />
      <Toast.Close
        aria-label="Dismiss"
        className="absolute top-1.5 right-2 cursor-pointer text-muted-foreground hover:text-foreground"
      >
        ×
      </Toast.Close>
    </Toast.Root>
  ));
};
