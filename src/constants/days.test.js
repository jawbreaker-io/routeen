import { describe, expect, it } from 'vitest';
import {
  DAY_KEYS,
  DAYS_OF_WEEK,
  WORKDAY_KEYS,
  createDayMap,
  getDayLabel,
  getDefaultStartTime,
} from './days';

describe('day metadata', () => {
  it('defines a seven-day planner order', () => {
    expect(DAY_KEYS).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
    expect(DAYS_OF_WEEK.map((day) => day.short)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('keeps Monday-Friday as workdays for projections', () => {
    expect(WORKDAY_KEYS).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  });

  it('keeps weekend start times at 9 AM', () => {
    expect(getDefaultStartTime('monday')).toBe('08:00');
    expect(getDefaultStartTime('friday')).toBe('08:00');
    expect(getDefaultStartTime('saturday')).toBe('09:00');
    expect(getDefaultStartTime('sunday')).toBe('09:00');
  });

  it('creates complete maps from all planner days', () => {
    expect(createDayMap((day) => day.short)).toEqual({
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun',
    });
  });

  it('formats unknown day keys defensively', () => {
    expect(getDayLabel('holiday')).toBe('Holiday');
  });
});
