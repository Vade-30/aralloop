"use client";

// The links in the app header. On wide screens they sit in the band beside the
// logo; on phones they fold into a menu that opens under the band.

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { PAGE_WIDTH, cn } from "./ui";

export interface NavLink {
  href: string;
  label: string;
}

/** The link whose address is the longest match for the page being shown. */
function activeHref(links: NavLink[], pathname: string): string | null {
  const matches = links.filter(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  );
  matches.sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? null;
}

interface AppNavProps {
  links: NavLink[];
  /** The AI status pill. */
  status: ReactNode;
  /** The signed-in user's name and the "Log out" button, or the links to log in. */
  account: ReactNode;
}

export function AppNav({ links, status, account }: AppNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const active = activeHref(links, pathname);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Nobody is signed in: there is nothing to fold away, so no menu button.
  // A phone has room for the two links only.
  if (links.length === 0) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden sm:inline-flex">{status}</span>
        {account}
      </div>
    );
  }

  return (
    <>
      <nav aria-label="Main" className="mr-auto hidden md:block">
        <ul className="flex items-center gap-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={link.href === active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-extrabold transition-[background-color,color,scale] duration-100 focus-visible:ring-2 focus-visible:ring-white active:scale-95",
                  link.href === active
                    ? "bg-accent-400 text-ink"
                    : "text-brand-100 hover:bg-white/15 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="hidden flex-wrap items-center gap-x-3 gap-y-2 md:flex">
        {status}
        {account}
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-white transition-[background-color,border-color,scale] duration-100 hover:border-white/60 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white active:scale-95 md:hidden"
      >
        {open ? (
          <X className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        )}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      {open && (
        <>
          {/* Tapping the page behind the menu closes it. */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-x-0 top-full h-screen bg-ink/40 md:hidden"
          />
          <div
            id={menuId}
            className="absolute inset-x-0 top-full animate-rise rounded-b-3xl border-t-2 border-white/15 bg-brand-900 shadow-[0_5px_0_#162a94] md:hidden"
          >
            <div className={cn("mx-auto flex w-full flex-col gap-4 px-4 pb-5 pt-3 sm:px-6", PAGE_WIDTH)}>
              <nav aria-label="Main">
                <ul className="flex flex-col gap-1.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={link.href === active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex min-h-12 items-center rounded-2xl px-4 font-display text-xl font-extrabold focus-visible:ring-2 focus-visible:ring-white",
                          link.href === active
                            ? "bg-accent-400 text-ink"
                            : "bg-white/10 text-white hover:bg-white/20",
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-t-2 border-white/15 pt-4">
                {account}
                {status}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
