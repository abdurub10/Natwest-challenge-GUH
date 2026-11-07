import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppStateProvider } from "@/components/AppState";
import { PhoneFrame } from "@/components/PhoneFrame";

export const metadata: Metadata = {
  title: "Headroom",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <PhoneFrame>{children}</PhoneFrame>
    </AppStateProvider>
  );
}
