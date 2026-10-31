// Calendar and email helpers for the client-side alert preferences. Nothing is sent anywhere:
// the .ics file is generated in the browser and the mailto link opens the viewer's own mail app.

function icsDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A one-day calendar reminder to re-check a location's assessment. */
export function reminderIcs({ locationName, url, asOf, hazards }: { locationName: string; url: string; asOf: string; hazards: string[] }): string {
  const day = addDays(asOf, 30);
  const what = hazards.length ? hazards.join(", ") : "all hazards";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Earth's Hidden Signals//Assessment reminder//EN",
    "BEGIN:VEVENT",
    `UID:${locationName.replace(/\W+/g, "-").toLowerCase()}-${day}@earths-hidden-signals`,
    `DTSTAMP:${icsDate(asOf)}T000000Z`,
    `DTSTART;VALUE=DATE:${icsDate(day)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(day, 1))}`,
    `SUMMARY:Re-check climate screening for ${locationName}`,
    `DESCRIPTION:Screening summary (${what}), not a warning. Follow your national met service. ${url}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

export function reminderMailto({ locationName, url, hazards }: { locationName: string; url: string; hazards: string[] }): string {
  const subject = `Climate screening reminder: ${locationName}`;
  const body = `Re-check the screening summary for ${locationName} (${hazards.join(", ") || "all hazards"}): ${url}\n\nThis is a screening summary, not a warning. Follow your national meteorological service.`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
