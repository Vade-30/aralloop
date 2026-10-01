// Shown for unknown addresses and whenever a page calls notFound(), for
// example when an activity belongs to another class.

import { House, SearchX } from "lucide-react";
import { LostArt } from "@/components/home/StateArt";
import { StateScreen } from "@/components/StateScreen";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <StateScreen
      title="Page not found"
      art={
        <LostArt>
          <SearchX />
        </LostArt>
      }
      message="This page does not exist, or it belongs to another account. Go back to the start and choose an account."
      actions={
        <ButtonLink href="/" size="lg">
          <House className="h-5 w-5" aria-hidden="true" />
          Go to the start
        </ButtonLink>
      }
    />
  );
}
