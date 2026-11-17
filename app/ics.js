/* Minimal RFC 5545 writer for all-day events. Pure functions, no DOM. */

function escapeText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line) {
  const encoder = new TextEncoder();
  let out = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 73) {
      out += "\r\n ";
      bytes = 1;
    }
    out += char;
    bytes += size;
  }
  return out;
}

function compactDate(iso) {
  return iso.replace(/-/g, "");
}

function nextDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function stamp(date) {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function isWeekend(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

function buildICS(events, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Deadline Calendar//US SMB//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Business filing deadlines",
    "X-WR-TIMEZONE:America/Los_Angeles",
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.key}@deadline-calendar`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(
        `${event.why}${isWeekend(event.date) ? "\n\nFalls on a weekend. The real due date moves to the next business day." : ""}\n\nAgency: ${event.agency}\nSource: ${event.source}\n\nConfirm details with your accountant or the agency before relying on this date.`
      )}`,
      `CATEGORIES:${escapeText(event.category)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

if (typeof module !== "undefined") {
  module.exports = { buildICS, foldLine, escapeText, nextDay };
}
