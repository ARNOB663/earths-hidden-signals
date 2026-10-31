"use client";

// Mounts sonner once for the whole site and follows the light/dark switch. It lives in its own
// client component so the root layout can stay a server component. The stacking order comes from
// the shared --z-toast token (see globals.css), because sonner's own container has no class hook.

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";

export function ToasterHost() {
  const theme = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      style={{ zIndex: "var(--z-toast)", "--border-radius": "12px" } as React.CSSProperties}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-line !bg-card !font-sans !text-ink !shadow-soft",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-ink-2",
          icon: "!text-ink-2",
          closeButton: "!border-line !bg-card !text-ink-2 hover:!text-ink",
          actionButton: "!rounded-full !bg-accent-strong !text-accent-ink",
          cancelButton: "!rounded-full !bg-sunken !text-ink-2",
        },
      }}
      mobileOffset={{ bottom: 16, left: 12, right: 12 }}
    />
  );
}
