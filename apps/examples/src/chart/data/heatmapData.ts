// 7-day × 24-hour activity heatmap — 168 rows total.
// Weekday business hours (9-17) show higher call volume and satisfaction.
// Weekend values are 30-45% of weekday peak.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
// Multipliers by day (Mon=peak, Sat/Sun=low)
const DAY_FACTOR = [1.0, 1.1, 1.05, 1.0, 0.85, 0.45, 0.30];

function hourCallBase(hour: number): number {
  if (hour >= 9 && hour <= 17) {
    // Bell-curve peak centred at 13:00
    return 80 + Math.round(Math.sin(((hour - 9) / 8) * Math.PI) * 55);
  }
  if (hour >= 18 && hour <= 22) return 18 + (22 - hour) * 3;
  return hour < 9 ? 4 + hour : 6;
}

function hourSatisfaction(hour: number): number {
  const isBusinessHour = hour >= 9 && hour <= 17;
  const base = isBusinessHour ? 4.2 : 3.8;
  // Lunch dip
  const lunchDip = hour === 12 ? -0.2 : 0;
  // Slightly lower at end of day
  const eodDip = hour === 17 ? -0.1 : 0;
  return Math.round((base + lunchDip + eodDip) * 10) / 10;
}

export const activityHeatmap = DAYS.flatMap((day, d) =>
  Array.from({ length: 24 }, (_, h) => ({
    day,
    hour: h,
    calls: Math.max(1, Math.round(hourCallBase(h) * DAY_FACTOR[d])),
    satisfaction: hourSatisfaction(h),
  }))
);
