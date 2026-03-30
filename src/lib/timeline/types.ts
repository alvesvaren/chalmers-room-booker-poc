export type TimeInterval = { start: Date; end: Date };

export type BusySegment = TimeInterval & {
  label?: string;
  reservationId?: string;
};

export type DayTimeline = {
  date: Date;
  dateStr: string;
  weekdayShort: string;
  displayStart: Date;
  displayEnd: Date;
  busy: BusySegment[];
  free: TimeInterval[];
};
