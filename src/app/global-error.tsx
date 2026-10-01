"use client";

// Fallback for a failure in the root layout itself, which error.tsx cannot
// catch. It replaces the whole document, so it has its own <html> and <body>,
// and inline styles only: the global CSS and the bundled fonts are not
// applied here. The colours are the app's own, so it still looks like AralLoop.

import { useEffect } from "react";

const FONT = "'Nunito Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

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
      <body style={{ margin: 0, fontFamily: FONT, color: "#16204a", backgroundColor: "#f7f9ff" }}>
        {/* The blue band, with the card pulled up over its bottom edge. */}
        <div style={{ backgroundColor: "#1e3084", padding: "28px 16px 88px" }}>
          <h1
            style={{
              margin: "0 auto",
              maxWidth: 560,
              fontSize: 32,
              lineHeight: 1.15,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            This page could not load
          </h1>
        </div>
        <main style={{ margin: "-56px auto 0", maxWidth: 560, padding: "0 16px 48px" }}>
          <div
            style={{
              padding: "24px 20px 28px",
              border: "2px solid #e3e9f8",
              borderRadius: 24,
              backgroundColor: "#ffffff",
              boxShadow: "0 5px 0 #e3e9f8",
            }}
          >
            <p
              role="alert"
              style={{ margin: 0, fontSize: 16, lineHeight: 1.5, fontWeight: 600, color: "#5a6585" }}
            >
              Something went wrong on our side. Please try again.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 16,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  minHeight: 48,
                  padding: "0 22px",
                  border: "none",
                  borderRadius: 16,
                  backgroundColor: "#f7c948",
                  boxShadow: "0 5px 0 #c99a12",
                  color: "#16204a",
                  fontFamily: FONT,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              {/* A plain link: a full page load is the surest way out of a broken layout. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" style={{ color: "#1d3ad0", fontSize: 15, fontWeight: 800 }}>
                Go to the start
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
