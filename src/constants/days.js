export const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon', defaultStartTime: '08:00', isWorkday: true },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue', defaultStartTime: '08:00', isWorkday: true },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed', defaultStartTime: '08:00', isWorkday: true },
  { key: 'thursday', label: 'Thursday', short: 'Thu', defaultStartTime: '08:00', isWorkday: true },
  { key: 'friday', label: 'Friday', short: 'Fri', defaultStartTime: '08:00', isWorkday: true },
  { key: 'saturday', label: 'Saturday', short: 'Sat', defaultStartTime: '09:00', isWorkday: false },
  { key: 'sunday', label: 'Sunday', short: 'Sun', defaultStartTime: '09:00', isWorkday: false },
];

export const DAY_KEYS = DAYS_OF_WEEK.map((day) => day.key);
export const WORKDAY_DAYS = DAYS_OF_WEEK.filter((day) => day.isWorkday);
export const WORKDAY_KEYS = WORKDAY_DAYS.map((day) => day.key);

const DAY_BY_KEY = Object.fromEntries(DAYS_OF_WEEK.map((day) => [day.key, day]));

export function createDayMap(factory) {
  return Object.fromEntries(DAYS_OF_WEEK.map((day) => [day.key, factory(day)]));
}

export function getDayMeta(dayKey) {
  return DAY_BY_KEY[dayKey];
}

export function getDayLabel(dayKey, labelType = 'label') {
  const day = getDayMeta(dayKey);
  if (day?.[labelType]) return day[labelType];
  return dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
}

export function getDefaultStartTime(dayKey) {
  return getDayMeta(dayKey)?.defaultStartTime || '08:00';
}
