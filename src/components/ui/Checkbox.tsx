import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

const rootClass =
  "mt-1 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-md border border-te-border bg-te-elevated shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-[border-color,background-color,box-shadow] duration-150 hover:border-te-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-te-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-te-bg disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-te-accent data-[state=checked]:bg-te-accent data-[state=checked]:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

const indicatorClass = "flex text-te-on-accent";

type CheckboxProps = ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
  /** Keeps the checkmark in the DOM when unchecked; use with `data-[state=unchecked]:invisible` styling for stable layout. */
  indicatorForceMount?: boolean;
};

/**
 * Radix Checkbox with app accent styling (no native blue). Use `onCheckedChange`
 * with a boolean guard when state is not indeterminate: `c === true`.
 */
export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(function Checkbox(
  {
    className = "",
    children,
    indicatorForceMount,
    ...props
  },
  ref,
) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={`${rootClass} ${className}`.trim()}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={
          indicatorForceMount
            ? `${indicatorClass} data-[state=unchecked]:invisible`
            : indicatorClass
        }
        forceMount={indicatorForceMount ? true : undefined}
      >
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className="size-2.5"
          aria-hidden
        >
          <path
            d="M2.5 6.2 5 8.7 9.5 3.3"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
      {children}
    </CheckboxPrimitive.Root>
  );
});
