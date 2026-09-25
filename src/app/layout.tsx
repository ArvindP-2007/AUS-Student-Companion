import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUS Companion",
  description: "Your academic life, in one calm place.",
  applicationName: "AUS Companion",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AUS Companion",
    statusBarStyle: "default",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f6",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
