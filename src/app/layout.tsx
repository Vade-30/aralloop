import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "AralLoop",
  description:
    "From lesson to activity to feedback to parent: an AI classroom loop with the teacher in control.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <AppHeader />
        {children}
        <footer className="mx-auto w-full max-w-3xl px-4 py-6 text-xs text-slate-500">
          Prototype with sample data. Activities, grades and summaries marked with ✦
          are AI-generated and reviewed by the teacher.
        </footer>
      </body>
    </html>
  );
}
