import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, name, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      name={name ?? "input"}
      className={cn(
        "flex h-8 w-full rounded-md border border-input bg-card px-2.5 py-1 text-[13px] shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
