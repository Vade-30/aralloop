import type { Metadata, Viewport } from "next";
// Fonts are installed with the app, so it also looks right with no internet.
import "@fontsource-variable/baloo-2";
import "@fontsource-variable/nunito";
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
        <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-xs font-semibold text-muted sm:px-6">
          Prototype with sample data. AI-written content is labelled. The teacher reviews
          every activity before it is published and can change any score.
        </footer>
      </body>
    </html>
  );
}
