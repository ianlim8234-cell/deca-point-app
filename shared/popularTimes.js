// Busyness index read from the Google "Popular times" screenshots supplied by the team
// (popular_hours.pdf, 7 pages, Monday–Sunday).
//
// Method: on each screenshot we measured each bar's pixel height from the baseline and
// divided by the height of the dashed reference line. Google scales every day of the week
// against the same reference, so the values can be compared across days. Fri 6 PM (~94) is
// the busiest hour of the week.
// The values are RELATIVE busyness (0–100), not customer counts. Read error is roughly ±3 points.
//
// Hours are the bar's start hour in 24h restaurant-local time (America/Chicago).
// Bars run 11 AM–10 PM Sun–Thu and 11 AM–11 PM Fri–Sat, which suggests those are the
// operating hours. Confirm them with the restaurant.

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// index 0 = Sunday … 6 = Saturday; keys are start hours
export const POPULAR_TIMES = {
  0: { 11: 35, 12: 52, 13: 68, 14: 68, 15: 56, 16: 52, 17: 55, 18: 67, 19: 70, 20: 57, 21: 39 },
  1: { 11: 45, 12: 59, 13: 59, 14: 57, 15: 49, 16: 45, 17: 41, 18: 43, 19: 36, 20: 33, 21: 22 },
  2: { 11: 24, 12: 36, 13: 36, 14: 41, 15: 40, 16: 50, 17: 53, 18: 68, 19: 59, 20: 50, 21: 31 },
  3: { 11: 27, 12: 31, 13: 40, 14: 41, 15: 38, 16: 33, 17: 37, 18: 43, 19: 43, 20: 33, 21: 24 },
  4: { 11: 33, 12: 43, 13: 40, 14: 40, 15: 36, 16: 39, 17: 45, 18: 56, 19: 54, 20: 45, 21: 37 },
  5: { 11: 38, 12: 42, 13: 40, 14: 37, 15: 38, 16: 50, 17: 74, 18: 94, 19: 90, 20: 76, 21: 57, 22: 43 },
  6: { 11: 40, 12: 50, 13: 61, 14: 62, 15: 63, 16: 62, 17: 73, 18: 73, 19: 73, 20: 63, 21: 45, 22: 33 },
};

// Classification thresholds used to derive the recommended schedule.
export const THRESHOLDS = {
  verySlow: 30, // <= 30  -> 2.0x candidate ("special slow period")
  slow: 40, //     <= 40  -> 1.5x candidate
  peak: 60, //     >= 60  -> never rewarded
};

export function classify(value) {
  if (value == null) return 'closed';
  if (value <= THRESHOLDS.verySlow) return 'very-slow';
  if (value <= THRESHOLDS.slow) return 'slow';
  if (value >= THRESHOLDS.peak) return 'peak';
  return 'moderate';
}

export function hourLabel(h) {
  const hh = ((h + 11) % 12) + 1;
  return `${hh}${h < 12 || h === 24 ? 'a' : 'p'}`;
}

// Recommended off-peak schedule taken from the data above. Each window lists the readings
// that justify it.
export const RECOMMENDED_WINDOWS = [
  { day: 0, start: '11:00', end: '12:00', multiplier: 1.5, evidence: 'Sun 11a = 35' },
  { day: 0, start: '21:00', end: '22:00', multiplier: 1.5, evidence: 'Sun 9p = 39' },
  { day: 1, start: '19:00', end: '21:00', multiplier: 1.5, evidence: 'Mon 7p = 36, 8p = 33' },
  { day: 1, start: '21:00', end: '22:00', multiplier: 2, evidence: 'Mon 9p = 22 (lowest of week)' },
  { day: 2, start: '11:00', end: '12:00', multiplier: 2, evidence: 'Tue 11a = 24' },
  { day: 2, start: '12:00', end: '14:00', multiplier: 1.5, evidence: 'Tue 12p = 36, 1p = 36' },
  { day: 2, start: '21:00', end: '22:00', multiplier: 1.5, evidence: 'Tue 9p = 31' },
  { day: 3, start: '11:00', end: '12:00', multiplier: 2, evidence: 'Wed 11a = 27' },
  { day: 3, start: '12:00', end: '13:00', multiplier: 1.5, evidence: 'Wed 12p = 31' },
  { day: 3, start: '15:00', end: '18:00', multiplier: 1.5, evidence: 'Wed 3p = 38, 4p = 33, 5p = 37' },
  { day: 3, start: '20:00', end: '21:00', multiplier: 1.5, evidence: 'Wed 8p = 33' },
  { day: 3, start: '21:00', end: '22:00', multiplier: 2, evidence: 'Wed 9p = 24' },
  { day: 4, start: '11:00', end: '12:00', multiplier: 1.5, evidence: 'Thu 11a = 33' },
  { day: 4, start: '15:00', end: '17:00', multiplier: 1.5, evidence: 'Thu 3p = 36, 4p = 39' },
  { day: 4, start: '21:00', end: '22:00', multiplier: 1.5, evidence: 'Thu 9p = 37' },
  { day: 5, start: '11:00', end: '12:00', multiplier: 1.5, evidence: 'Fri 11a = 38' },
  { day: 5, start: '14:00', end: '16:00', multiplier: 1.5, evidence: 'Fri 2p = 37, 3p = 38' },
  { day: 6, start: '22:00', end: '23:00', multiplier: 1.5, evidence: 'Sat 10p = 33' },
];

// Hours that are explicitly NOT rewarded (already busy) – for presentation.
export const PEAK_SUMMARY = [
  'Friday 5–10 PM (74–94) is the busiest block of the week',
  'Saturday 1–9 PM (61–73) stays busy all afternoon and evening',
  'Sunday 1–3 PM and 6–8 PM (67–70): brunch/lunch and dinner peaks',
  'Tuesday 6 PM (68) is a mid-week dinner spike',
];
