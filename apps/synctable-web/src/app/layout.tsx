import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synctable - Cross-Browser Tab & Workspace Sync",
  description: "Cross-browser tree backup and workspace synchronization utility",
  icons: {
    icon: "/logo.png",
    shortcut: "/favicon.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
