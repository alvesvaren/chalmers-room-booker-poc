import type { HTMLAttributes } from 'react'

export function Skeleton({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-te-border/60 dark:bg-te-border/40 ${className}`}
      {...props}
    />
  )
}
