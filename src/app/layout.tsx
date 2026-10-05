import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SignalDesk — Developer infrastructure status",
  description:
    "One clear view of developer service status, reported incidents, and status-feed response times.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
