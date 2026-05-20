import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amar eCom v2",
  description: "Modern admin dashboard for Amar eCom",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
