import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Production Planner | Daily blend planning",
  description: "Balance juice blend recipes, ingredient supply and processing time for a production day.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
