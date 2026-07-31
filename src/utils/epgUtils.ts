import { EPGProgram } from "../types";

/**
 * Calculates current live EPG program progress percentage (0-100%) dynamically.
 * If start/end times exist, compares current time to program window.
 * Otherwise, calculates live progress percentage within current hour.
 */
export function calculateEpgProgress(epg?: EPGProgram | null): number {
  if (!epg || !epg.startTime || !epg.endTime) {
    const now = new Date();
    const currentSeconds = now.getMinutes() * 60 + now.getSeconds();
    return Math.min(
      100,
      Math.max(5, Math.floor((currentSeconds / 3600) * 100)),
    );
  }

  try {
    const now = new Date();
    const parseTime = (timeStr: string) => {
      if (timeStr.includes("T") || timeStr.includes("-")) {
        return new Date(timeStr).getTime();
      }
      const isPm = /pm/i.test(timeStr);
      const isAm = /am/i.test(timeStr);
      const clean = timeStr.replace(/(am|pm)/i, "").trim();
      const parts = clean.split(":").map(Number);
      let hours = parts[0] || 0;
      const minutes = parts[1] || 0;
      if (isPm && hours < 12) hours += 12;
      if (isAm && hours === 12) hours = 0;

      const date = new Date(now);
      date.setHours(hours, minutes, 0, 0);
      return date.getTime();
    };

    const start = parseTime(epg.startTime);
    let end = parseTime(epg.endTime);
    if (end <= start) end += 24 * 3600 * 1000;

    const current = now.getTime();
    if (current < start) return 0;
    if (current > end) return 100;

    const progress = Math.round(((current - start) / (end - start)) * 100);
    return Math.min(100, Math.max(0, progress));
  } catch {
    const now = new Date();
    return Math.floor(
      ((now.getMinutes() * 60 + now.getSeconds()) / 3600) * 100,
    );
  }
}
