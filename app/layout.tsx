import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Geo: Second Coming",
  description: "A strategy-first geography drafting game powered by official country data."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
