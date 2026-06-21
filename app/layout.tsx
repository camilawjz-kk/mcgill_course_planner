import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Semester Balance Checker",
  description: "Choose five courses and estimate your semester workload.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
