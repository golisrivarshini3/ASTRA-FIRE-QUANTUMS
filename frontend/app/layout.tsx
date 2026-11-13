import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ASTRA-FIRE | Space Combustion Intelligence",
  description: "Evidence-first space combustion research and flame image analysis."
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
