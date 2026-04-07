import {
  useQuery,
  type QueryFunctionContext,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getApiBookingsOptions,
  getApiBookingsQueryKey,
  getApiMyBookingsOptions,
  getApiRoomsOptions,
} from "../client/@tanstack/react-query.gen";
import { getApiBookings } from "../client/sdk.gen";
import type { AllRoomsBookings } from "../client/types.gen";
import {
  capacitySliderBounds,
  displayCapacityRange,
} from "../lib/capacityBounds";

export type WorkspaceBookingsRequestQuery = {
  weekOffset: string;
  q?: string;
};

export type WorkspaceCapacityRange = { min: number; max: number };

export function useWorkspaceServerData(
  bookingsRequestQuery: WorkspaceBookingsRequestQuery,
  capacityRange: WorkspaceCapacityRange,
) {
  const roomsQueryOptions = useMemo(() => getApiRoomsOptions(), []);
  const roomsQuery = useQuery(roomsQueryOptions);

  const bookingsQueryOptions = useMemo(() => {
    const base = getApiBookingsOptions({ query: bookingsRequestQuery });
    type BookingsQK = ReturnType<typeof getApiBookingsQueryKey>;
    return {
      ...base,
      /**
       * Omit TanStack's `signal` so leaving this query (e.g. week change) does not mark the
       * fetch as abort-consuming; in-flight requests finish and populate the cache in the background.
       */
      queryFn: async ({ queryKey }: QueryFunctionContext<BookingsQK>) => {
        const { data } = await getApiBookings({
          ...queryKey[0],
          throwOnError: true,
        });
        return data;
      },
    };
  }, [bookingsRequestQuery]);
  const bookingsQuery = useQuery(bookingsQueryOptions);

  const myBookingsQueryOptions = useMemo(() => getApiMyBookingsOptions(), []);
  const myBookingsQuery = useQuery(myBookingsQueryOptions);

  const bookingsGrid: AllRoomsBookings | undefined = bookingsQuery.data;

  const bookingsUiStale =
    Boolean(bookingsGrid) && bookingsQuery.isFetching && bookingsQuery.isStale;
  const roomsUiStale =
    Boolean(roomsQuery.data) && roomsQuery.isFetching && roomsQuery.isStale;
  const myBookingsUiStale =
    Boolean(myBookingsQuery.data) &&
    myBookingsQuery.isFetching &&
    myBookingsQuery.isStale;

  const capacityBounds = capacitySliderBounds(roomsQuery.data);
  const capacityDisplay = displayCapacityRange(capacityBounds, capacityRange);

  const workspaceError =
    roomsQuery.isError || bookingsQuery.isError || myBookingsQuery.isError
      ? (roomsQuery.error ??
        bookingsQuery.error ??
        myBookingsQuery.error ??
        null)
      : null;

  return {
    roomsQuery,
    bookingsQuery,
    myBookingsQuery,
    bookingsGrid,
    bookingsUiStale,
    roomsUiStale,
    myBookingsUiStale,
    capacityBounds,
    capacityDisplay,
    workspaceError,
  };
}
