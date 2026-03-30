import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type VirtualizedWindowGridProps<T> = {
  items: readonly T[];
  getItemKey: (item: T, index: number) => string;
  /** Minimum card width in px (match your CSS `minmax(min(min(100%,X),1fr))`). */
  minCardWidthPx: number;
  /** Initial row height guess; rows are measured for variable height. */
  estimateRowHeightPx: number;
  /** Gap between cards and between rows (Tailwind `gap-4` → 16). */
  gapPx?: number;
  overscan?: number;
  className?: string;
  renderItem: (item: T) => ReactNode;
  /**
   * When false, the grid is not mounted. Use while the host tab/panel is hidden
   * (`display: none`); otherwise size is 0×0 and the window virtualizer gets a
   * bogus scrollMargin until a lucky resize.
   */
  enabled?: boolean;
};

function isMeasurableHost(el: HTMLElement) {
  if (typeof el.checkVisibility === "function") {
    return el.checkVisibility();
  }
  const r = el.getBoundingClientRect();
  return (
    r.width > 0 || r.height > 0 || el.clientWidth > 0 || el.clientHeight > 0
  );
}

/**
 * Window-scroll grid: each virtual row holds up to N columns derived from container width.
 * Uses [TanStack Virtual](https://tanstack.com/virtual/latest) with per-row measurement.
 */
export function VirtualizedWindowGrid<T>({
  items,
  getItemKey,
  minCardWidthPx,
  estimateRowHeightPx,
  gapPx = 16,
  overscan = 4,
  className,
  renderItem,
  enabled = true,
}: VirtualizedWindowGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      if (!isMeasurableHost(el)) return;
      // Document Y of list top — `offsetTop` is wrong when offsetParent ≠ document body.
      const docTop =
        el.getBoundingClientRect().top + window.scrollY;
      setScrollMargin(Math.round(docTop));
      const w = el.clientWidth;
      const c = Math.max(
        1,
        Math.floor((w + gapPx) / (minCardWidthPx + gapPx)),
      );
      setColumns(c);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [enabled, gapPx, minCardWidthPx]);

  const rowCount = Math.ceil(items.length / columns);

  const rowVirtualizer = useWindowVirtualizer({
    count: enabled ? rowCount : 0,
    overscan,
    scrollMargin,
    gap: gapPx,
    estimateSize: () => estimateRowHeightPx,
    getItemKey: (index) => `${columns}:${index}`,
  });

  const margin = rowVirtualizer.options.scrollMargin;

  if (!enabled) return null;

  return (
    <div ref={containerRef} className={className}>
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((vr) => {
          const start = vr.index * columns;
          const rowItems = items.slice(start, start + columns);
          return (
            <div
              key={vr.key}
              data-index={vr.index}
              ref={rowVirtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{
                transform: `translateY(${vr.start - margin}px)`,
              }}
            >
              <div
                className="grid min-w-0"
                style={{
                  gap: gapPx,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {rowItems.map((item, i) => (
                  <div key={getItemKey(item, start + i)} className="min-w-0">
                    {renderItem(item)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
