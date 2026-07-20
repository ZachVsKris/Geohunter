import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas Draft",
  description: "A strategy-first country statistics game built with official data."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
