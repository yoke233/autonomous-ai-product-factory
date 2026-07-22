import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, name, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      name={name ?? "textarea"}
      className={cn(
        "flex w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-[13px] shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
