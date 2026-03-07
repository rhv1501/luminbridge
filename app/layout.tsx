import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "./PWARegister";

export const metadata: Metadata = {
  title: "B2B Marketplace",
  description: "B2B Marketplace",
  manifest: "/manifest.webmanifest",
  applicationName: "B2B Marketplace",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "B2B Marketplace",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
