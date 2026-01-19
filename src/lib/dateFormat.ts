const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDisplayDate(isoDate: string): string {
  // Use noon UTC to avoid date shifts from local time zones.
  const d = new Date(`${isoDate}T12:00:00Z`);
  return dateFormatter.format(d);
}

export function formatDisplayDateFromDate(d: Date): string {
  return dateFormatter.format(d);
}

