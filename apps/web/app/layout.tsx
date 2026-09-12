import type { Metadata, Viewport } from "next";
import { Inter, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ThemeInitializer from "@/components/ThemeInitializer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

const APP_NAME = "Loan On Tip | HRMS";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://hrms.loanontip.com"),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: "People operations platform for ACG Leasing Limited",
  applicationName: "Loan On Tip HRMS",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: "People operations platform for ACG Leasing Limited",
    images: [{ url: "/logo.png", alt: "Loan On Tip HRMS" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1419" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <ThemeInitializer />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}