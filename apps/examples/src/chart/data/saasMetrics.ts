// SaaS metrics data for chart demo scenes.
// Challenge 10 fix: datum-morphing requires shared `quarter` key values between
// yearA and yearB. BOTH arrays MUST have identical `quarter` values ('Q1','Q2','Q3','Q4').
// The keyField='quarter' in Scene 1's DSL matches datums by this field.

export const saasMetricsYearA = [
  { quarter: 'Q1', revenue: 128, costs: 87,  profit: 41 },
  { quarter: 'Q2', revenue: 184, costs: 115, profit: 69 },
  { quarter: 'Q3', revenue: 231, costs: 142, profit: 89 },
  { quarter: 'Q4', revenue: 314, costs: 188, profit: 126 },
];

// CRITICAL: quarter values must exactly match saasMetricsYearA for datum morphing to work.
export const saasMetricsYearB = [
  { quarter: 'Q1', revenue: 165, costs: 102, profit: 63 },
  { quarter: 'Q2', revenue: 218, costs: 135, profit: 83 },
  { quarter: 'Q3', revenue: 287, costs: 168, profit: 119 },
  { quarter: 'Q4', revenue: 362, costs: 209, profit: 153 },
];

export const saasMetrics24Months = [
  { month: 'Jan',    arr: 1536, revenue: 128, costs: 87 },
  { month: 'Feb',    arr: 1740, revenue: 145, costs: 94 },
  { month: 'Mar',    arr: 1584, revenue: 132, costs: 88 },
  { month: 'Apr',    arr: 2016, revenue: 168, costs: 107 },
  { month: 'May',    arr: 2340, revenue: 195, costs: 121 },
  { month: 'Jun',    arr: 2208, revenue: 184, costs: 115 },
  { month: 'Jul',    arr: 2544, revenue: 212, costs: 130 },
  { month: 'Aug',    arr: 2772, revenue: 231, costs: 142 },
  { month: 'Sep',    arr: 2976, revenue: 248, costs: 149 },
  { month: 'Oct',    arr: 3204, revenue: 267, costs: 161 },
  { month: 'Nov',    arr: 3468, revenue: 289, costs: 174 },
  { month: 'Dec',    arr: 3768, revenue: 314, costs: 188 },
  { month: 'Jan Y2', arr: 3900, revenue: 325, costs: 196 },
  { month: 'Feb Y2', arr: 4200, revenue: 350, costs: 210 },
  { month: 'Mar Y2', arr: 4050, revenue: 337, costs: 200 },
  { month: 'Apr Y2', arr: 4560, revenue: 380, costs: 228 },
  { month: 'May Y2', arr: 5040, revenue: 420, costs: 252 },
  { month: 'Jun Y2', arr: 4800, revenue: 400, costs: 240 },
  { month: 'Jul Y2', arr: 5400, revenue: 450, costs: 270 },
  { month: 'Aug Y2', arr: 5880, revenue: 490, costs: 294 },
  { month: 'Sep Y2', arr: 6240, revenue: 520, costs: 312 },
  { month: 'Oct Y2', arr: 6480, revenue: 540, costs: 324 },
  { month: 'Nov Y2', arr: 7200, revenue: 600, costs: 360 },
  { month: 'Dec Y2', arr: 7680, revenue: 640, costs: 384 },
];

export const regionalRevenue = [
  { month: 'Jan', apac: 38,  emea: 52,  americas: 38 },
  { month: 'Feb', apac: 42,  emea: 61,  americas: 42 },
  { month: 'Mar', apac: 39,  emea: 55,  americas: 38 },
  { month: 'Apr', apac: 48,  emea: 74,  americas: 46 },
  { month: 'May', apac: 56,  emea: 88,  americas: 51 },
  { month: 'Jun', apac: 52,  emea: 82,  americas: 50 },
  { month: 'Jul', apac: 60,  emea: 96,  americas: 56 },
  { month: 'Aug', apac: 67,  emea: 104, americas: 60 },
  { month: 'Sep', apac: 70,  emea: 112, americas: 66 },
  { month: 'Oct', apac: 75,  emea: 120, americas: 72 },
  { month: 'Nov', apac: 82,  emea: 130, americas: 77 },
  { month: 'Dec', apac: 89,  emea: 142, americas: 83 },
];
