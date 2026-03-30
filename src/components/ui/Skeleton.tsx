import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-te-border/60 dark:bg-te-border/40 animate-pulse rounded-md ${className}`}
      {...props}
    />
  );
}
