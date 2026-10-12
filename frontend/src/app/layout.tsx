import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Production Planner feasibility harness",
  description: "Fictional sample for checking the deployed optimization path.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
