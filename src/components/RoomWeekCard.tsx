import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MyBooking, RoomWithReservations } from "../client/types.gen";
import { useTickingNow } from "../hooks/useTickingNow";
import { appLocaleBcp47 } from "../lib/datetime/intlFormat";
import { getRoomRating } from "../lib/roomRatings";
import {
  buildRoomWeekTimeline,
  firstFreeGapInWeek,
  formatLocalDate,
  formatLocalTime,
  intervalToPercent,
  isMyCalendarBusy,
  splitFreeGapForDisplay,
  type TimeInterval,
} from "../lib/weekTimeline";
import { Button } from "./ui/Button";

export function RoomWeekCard({
  room,
  weekStart,
  weekEndExclusive,
  onPickFree,
  onBookRoom,
  myBookings,
}: {
  room: RoomWithReservations;
  weekStart: Date;
  weekEndExclusive: Date;
  onPickFree: (room: RoomWithReservations, gap: TimeInterval) => void;
  onBookRoom: (room: RoomWithReservations) => void;
  myBookings: MyBooking[] | undefined;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const now = useTickingNow(60_000);
  const days = buildRoomWeekTimeline(room, weekStart, weekEndExclusive);
  const nextBookableGap = firstFreeGapInWeek(
    room,
    weekStart,
    weekEndExclusive,
    now,
  );
  const rr = getRoomRating(room.name);

  return (
    <article className="border-te-border bg-te-elevated hover:border-te-accent/25 flex h-full min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="border-te-border/80 flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={
            open
              ? t("roomWeek.hideTimeline", { name: room.name })
              : t("roomWeek.showTimeline", { name: room.name })
          }
        >
          <span className="font-display text-te-text block text-lg leading-tight font-semibold tracking-tight sm:text-xl">
            {room.name}
          </span>
          <span className="text-te-muted mt-2 block text-sm">
            <span className="text-te-text/90 font-medium">{room.campus}</span>
            <span
              aria-hidden
              className="bg-te-border mx-2 inline-block h-3 w-px translate-y-px align-middle"
            />
            <span className="tabular-nums">
              {room.capacity != null
                ? t("roomWeek.nSeats", { count: room.capacity })
                : "—"}
            </span>
            {rr != null ? (
              <>
                <span
                  aria-hidden
                  className="bg-te-border mx-2 inline-block h-3 w-px translate-y-px align-middle"
                />
                <span
                  className="font-display text-te-accent cursor-help text-base font-semibold tabular-nums"
                  title={rr.comment}
                >
                  {rr.overall.toLocaleString(appLocaleBcp47(), {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>
              </>
            ) : null}
          </span>
        </button>
        <Button
          variant="primary"
          className="w-full shrink-0 touch-manipulation py-2.5 text-sm font-semibold sm:w-auto sm:px-5"
          disabled={!nextBookableGap}
          title={
            !nextBookableGap ? t("roomWeek.noFreeWeek") : undefined
          }
          onClick={() => {
            if (nextBookableGap) onBookRoom(room);
          }}
        >
          {t("rooms.book")}
        </Button>
      </div>

      {open ? (
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div className="text-te-muted ml-12 hidden justify-between text-[10px] font-medium tracking-wider uppercase sm:flex">
            <span>07</span>
            <span>10</span>
            <span>13</span>
            <span>16</span>
            <span>19</span>
            <span>22</span>
          </div>

          {days.map((day) => (
            <div
              key={day.dateStr}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr] sm:items-center"
            >
              <div className="text-te-muted text-xs font-medium capitalize sm:w-14">
                <span className="text-te-text sm:hidden">
                  {day.weekdayShort} {formatLocalDate(day.date)}{" "}
                </span>
                <span className="hidden sm:inline">{day.weekdayShort}</span>
              </div>
              <div className="bg-te-border/25 relative h-9 overflow-hidden rounded-lg">
                {day.free.flatMap((g, i) => {
                  const { past, future } = splitFreeGapForDisplay(g, now);
                  const els: ReactNode[] = [];
                  if (past) {
                    const { leftPct, widthPct } = intervalToPercent(
                      past,
                      day.displayStart,
                      day.displayEnd,
                    );
                    els.push(
                      <div
                        key={`${day.dateStr}-past-${i}`}
                        title={t("roomWeek.pastTime")}
                        className="border-te-border/40 bg-te-border/50 pointer-events-none absolute inset-y-1 z-0 rounded border"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 0.6)}%`,
                        }}
                      />,
                    );
                  }
                  if (future) {
                    const { leftPct, widthPct } = intervalToPercent(
                      future,
                      day.displayStart,
                      day.displayEnd,
                    );
                    const label = `${formatLocalTime(future.start)}–${formatLocalTime(future.end)}`;
                    els.push(
                      <button
                        key={`${day.dateStr}-fut-${i}`}
                        type="button"
                        title={t("roomWeek.bookSlot", { label })}
                        className="border-te-accent/25 bg-te-free-hover hover:bg-te-accent-muted absolute inset-y-1 z-0 rounded border"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 1.2)}%`,
                        }}
                        onClick={() => onPickFree(room, future)}
                      />,
                    );
                  }
                  return els;
                })}
                {day.busy.map((b, i) => {
                  const { leftPct, widthPct } = intervalToPercent(
                    b,
                    day.displayStart,
                    day.displayEnd,
                  );
                  const range = `${formatLocalTime(b.start)}–${formatLocalTime(b.end)}`;
                  const mine = isMyCalendarBusy(b, room.id, myBookings);
                  const title = mine
                    ? b.label
                      ? t("roomWeek.busyBlockMineLabeled", {
                          range,
                          label: b.label,
                        })
                      : t("roomWeek.busyBlockMine", { range })
                    : b.label
                      ? t("roomWeek.busyBlockOtherLabeled", {
                          range,
                          label: b.label,
                        })
                      : t("roomWeek.busyBlockOther", { range });
                  return (
                    <div
                      key={`b-${i}`}
                      title={title}
                      className={`pointer-events-auto absolute inset-y-1 z-10 flex cursor-default items-center justify-center overflow-hidden rounded-sm px-0.5 shadow-inner ${
                        mine ? "bg-te-mine-busy/85" : "bg-te-busy-strong/85"
                      }`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 0.6)}%`,
                      }}
                    >
                      {b.label ? (
                        <span
                          className={`font-display truncate text-center text-[0.55rem] leading-tight font-semibold sm:text-[0.62rem] ${
                            mine
                              ? "text-te-mine-busy-text drop-shadow-none"
                              : "text-white drop-shadow-sm"
                          }`}
                        >
                          {b.label}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <ul className="sr-only">
            {days.flatMap((d) =>
              d.busy.map((b, j) => (
                <li key={`${d.dateStr}-${j}`}>
                  {t("roomWeek.srBusyLine", {
                    weekday: d.weekdayShort,
                    start: formatLocalTime(b.start),
                    end: formatLocalTime(b.end),
                    labelPart: b.label ? `, ${b.label}` : "",
                  })}
                </li>
              )),
            )}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
