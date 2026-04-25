import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jersey Swap",
  description: "Visualize football recruits in college program jerseys",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">{children}</body>
    </html>
  );
}
