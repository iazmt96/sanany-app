import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { getSiteUrl } from "../src/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "سنعني | SANANY Marketplace",
    template: "%s | SANANY"
  },
  description: "SANANY multi-platform marketplace",
  applicationName: "SANANY",
  alternates: {
    canonical: "/ar"
  },
  openGraph: {
    type: "website",
    title: "سنعني | SANANY Marketplace",
    description: "SANANY multi-platform marketplace",
    siteName: "SANANY",
    url: "/ar",
    images: [{ url: "/brand/sanany-logo.png" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "سنعني | SANANY Marketplace",
    description: "SANANY multi-platform marketplace",
    images: ["/brand/sanany-logo.png"]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
