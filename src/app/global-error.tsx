"use client";

// Fallback for a failure in the root layout itself, which error.tsx cannot
// catch. It replaces the whole document, so it has its own <html> and <body>,
// and inline styles only: the global CSS is not applied here.

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  /** Loads the page's data again and re-renders it. */
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: "48px 16px",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          color: "#0f172a",
          backgroundColor: "#f8fafc",
        }}
      >
        <main style={{ margin: "0 auto", maxWidth: 480 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>This page could not load</h1>
          <p style={{ margin: "8px 0 20px", fontSize: 16, lineHeight: 1.5, color: "#475569" }}>
            Something went wrong on our side. Please try again.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                minHeight: 44,
                padding: "0 16px",
                border: "none",
                borderRadius: 8,
                backgroundColor: "#2549E6",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A plain link: a full page load is the surest way out of a broken layout. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#2549E6", fontSize: 14, fontWeight: 500 }}>
              Go to the start
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
