import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppStateProvider } from "@/components/AppState";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Headroom",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <AppShell>{children}</AppShell>
    </AppStateProvider>
  );
}
