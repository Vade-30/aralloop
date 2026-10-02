"use client";

// A password box with a button that shows or hides what was typed. There is
// no "type it again" box, so seeing the password is how a typo is caught.

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui";

export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input type={shown ? "text" : "password"} className="pr-12" {...props} />
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted hover:text-brand-700"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">{shown ? "Hide password" : "Show password"}</span>
      </button>
    </div>
  );
}
