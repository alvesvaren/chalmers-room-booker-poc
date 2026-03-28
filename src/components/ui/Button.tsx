import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-te-accent text-te-on-accent hover:bg-te-accent-hover shadow-sm disabled:opacity-50",
  secondary: "border border-te-border bg-te-elevated text-te-text hover:bg-te-surface",
  danger: "border border-te-danger/30 bg-te-danger-bg text-te-danger hover:opacity-90 disabled:opacity-50",
  ghost: "text-te-muted hover:bg-te-accent-muted hover:text-te-text",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      type='button'
      className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-te-accent ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
