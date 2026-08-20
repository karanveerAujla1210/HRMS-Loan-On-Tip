import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loan On Tip | People Operations",
  description: "HRMS for ACG Leasing Limited",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
