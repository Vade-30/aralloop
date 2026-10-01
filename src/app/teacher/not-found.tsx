// Shown when a lesson or activity does not exist or belongs to another class.

import { House, SearchX } from "lucide-react";
import { LostArt } from "@/components/home/StateArt";
import { StateScreen } from "@/components/StateScreen";
import { ButtonLink } from "@/components/ui";

export default function TeacherNotFound() {
  return (
    <StateScreen
      title="We could not find that page"
      art={
        <LostArt>
          <SearchX />
        </LostArt>
      }
      message="The lesson or activity may have been deleted, or the link is wrong."
      actions={
        <ButtonLink href="/teacher" size="lg">
          <House className="h-5 w-5" aria-hidden="true" />
          Back to class
        </ButtonLink>
      }
    />
  );
}
