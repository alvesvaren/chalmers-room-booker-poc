import type { Query } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteApiMyBookingsByIdMutation,
  getApiMyBookingsQueryKey,
  postApiMyBookingsMutation,
} from "../client/@tanstack/react-query.gen";

function isBookingsGridQuery(query: Query): boolean {
  const head = query.queryKey[0];
  if (head === null || typeof head !== "object" || !("_id" in head)) {
    return false;
  }
  const id = (head as { _id?: unknown })._id;
  return id === "getApiBookings";
}

export function useWorkspaceBookingsMutations() {
  const queryClient = useQueryClient();

  const invalidateBookingsAndMine = async () => {
    await queryClient.invalidateQueries({
      queryKey: getApiMyBookingsQueryKey(),
    });
    await queryClient.invalidateQueries({ predicate: isBookingsGridQuery });
  };

  const createBookingMutation = useMutation({
    ...postApiMyBookingsMutation(),
    onSuccess: invalidateBookingsAndMine,
  });

  const cancelMutation = useMutation({
    ...deleteApiMyBookingsByIdMutation(),
    onSuccess: invalidateBookingsAndMine,
  });

  return { createBookingMutation, cancelMutation };
}
