import type { Metadata } from "next";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Lutera | Private workspace",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/icon.svg?v=lutera-brand-20261102", type: "image/svg+xml" }],
    shortcut: "/favicon.ico?v=lutera-brand-20261102",
    apple: "/apple-icon.png",
  },
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
