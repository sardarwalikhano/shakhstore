import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "./service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "شاخ ستۆر | SHAKH STORE",
    template: "%s | SHAKH STORE",
  },
  description: "پلاتفۆرمی کڕین و گەیاندنی شاخ ستۆر",
  applicationName: "SHAKH STORE",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "SHAKH STORE",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f28c28",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ckb" dir="rtl">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
