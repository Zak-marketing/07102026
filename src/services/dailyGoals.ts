import type { NutritionEntry, WaterLogEntry } from '../types';
export const DAY_END_KEY = 'auraslim_v6_day_end';
export function dailyGoals(date: string, meals: NutritionEntry[], water: WaterLogEntry[], target: number, waterTarget: number) {
  const calories = Math.round(meals.filter(e => e.date === date).reduce((n,e) => n + Math.max(0, Number(e.calories) || 0), 0));
  const waterMl = water.filter(e => e.date === date).reduce((n,e) => n + Math.max(0, Number(e.amountMl) || 0), 0);
  const excess = Math.max(0, calories - target);
  const sufficientlyNourished = calories >= Math.ceil(target * 0.9);
  return {calories, waterMl, excess, sufficientlyNourished,
    success: target > 0 && waterTarget > 0 && excess === 0 && sufficientlyNourished && waterMl >= Math.round(waterTarget * 1000)};
}
export function closedDays(storage: Pick<Storage, 'getItem'>, profileId: string): string[] {
  try {const values = JSON.parse(storage.getItem(DAY_END_KEY) || '{}')[profileId]; return Array.isArray(values) ? values.filter(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) : [];} catch {return [];}
}
export function closeDay(storage: Pick<Storage, 'getItem' | 'setItem'>, profileId: string, date: string, closed: boolean) {
  let all: Record<string, string[]> = {}; try {all = JSON.parse(storage.getItem(DAY_END_KEY) || '{}') || {};} catch {}
  const days = closedDays(storage, profileId).filter(d => d !== date);
  all[profileId] = [...days, ...(closed ? [date] : [])].slice(-366);
  storage.setItem(DAY_END_KEY, JSON.stringify(all));
}
