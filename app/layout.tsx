import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loan On Tip | HRMS",
  description: "People operations for ACG Leasing Limited",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
