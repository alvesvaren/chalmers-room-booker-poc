import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteApiMyBookingsByIdMutation,
  getApiMyBookingsQueryKey,
  postApiMyBookingsMutation,
} from "../client/@tanstack/react-query.gen";
import { isBookingsGridQuery } from "../lib/bookingsQuery";

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
