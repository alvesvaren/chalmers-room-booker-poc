import type { InputHTMLAttributes } from "react";

const checkboxClass =
  "border-te-border text-te-accent focus:ring-te-accent/30 mt-1 size-4 shrink-0 rounded";

export function Checkbox({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="checkbox"
      className={`${checkboxClass} ${className}`.trim()}
      {...props}
    />
  );
}
