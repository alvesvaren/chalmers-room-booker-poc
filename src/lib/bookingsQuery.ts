import type { Query } from "@tanstack/react-query";

/** Invalidate every TanStack query whose key marks the week bookings grid (GET /api/bookings). */
export function isBookingsGridQuery(query: Query): boolean {
  const head = query.queryKey[0];
  if (head === null || typeof head !== "object" || !("_id" in head)) {
    return false;
  }
  const id = (head as { _id?: unknown })._id;
  return id === "getApiBookings";
}
