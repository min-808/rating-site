// components/ThemeProvider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // We use data-theme to match the CSS we wrote in Step 1
  return <NextThemesProvider attribute="data-theme">{children}</NextThemesProvider>;
}