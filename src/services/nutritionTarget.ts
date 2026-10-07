import type { DailyActivity, UserProfile } from '../types';

// Mifflin–St Jeor (1990) estimates resting expenditure. Movement factors and
// moderate-exercise energy are starting estimates, not measured expenditure.
const movementFactors: Record<DailyActivity, number> = {seated: 1.2, mixed: 1.35, moving: 1.5, physical: 1.65};
const finite = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;

export function nutritionTarget(profile: UserProfile, suppliedBmr?: number) {
  let measuredBmr = suppliedBmr || profile.restingMetabolismKcal || 0;
  if (!measuredBmr) try {
    const scans = JSON.parse(localStorage.getItem(`auraslim_inbody_scans_${profile.id}`) || '[]');
    measuredBmr = Number(scans[0]?.bmrKcal) || 0;
  } catch { /* Optional InBody reading. */ }
  const measured = measuredBmr >= 500 && measuredBmr <= 4000;
  const weight = finite(profile.currentWeight, 75, 30, 350);
  const height = finite(profile.heightCm, 168, 100, 250);
  const age = finite(profile.age, 28, 18, 120);
  const sex = profile.metabolismSex || profile.gender;
  const approximateSex = !['female', 'male'].includes(sex);
  const bmr = measured ? measuredBmr : Math.max(500, 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : sex === 'female' ? -161 : -78));
  const activityKnown = !!profile.dailyActivity && Object.hasOwn(movementFactors, profile.dailyActivity);
  const exerciseMinutes = finite(profile.exerciseMinutesPerWeek, 0, 0, 600);
  // Exercise is separate from movement at work, so sport is counted only once.
  const exerciseEnergy = activityKnown ? 3 * weight * exerciseMinutes / 60 / 7 : 0;
  const maintenance = bmr * (activityKnown ? movementFactors[profile.dailyActivity!] : 1.35) + exerciseEnergy;
  const needsReview = !!profile.needsProfessionalPlan || profile.age < 18 || (profile.weightGoal === 'lose' && Math.min(weight, finite(profile.targetWeight,weight,30,350)) / (height / 100) ** 2 < 18.5);
  const adjustment = needsReview ? 0 : profile.weightGoal === 'gain' ? 300 : profile.weightGoal === 'maintain' ? 0 : -Math.min(300, maintenance * 0.15);
  const estimatedCalories = Math.round(Math.max(bmr, 1500, maintenance + adjustment) / 10) * 10;
  const calories = needsReview ? finite(profile.dailyCalorieTarget, Math.round(maintenance / 10) * 10, 1200, 7000) : estimatedCalories;
  // Adjustable fluid guide. Preserve manual or medically restricted targets.
  const movementWater = activityKnown ? ({seated: 0, mixed: 0.25, moving: 0.5, physical: 0.75})[profile.dailyActivity!] : 0;
  const estimatedWater = Math.round(Math.min(3, (weight < 60 ? 1.75 : weight >= 90 ? 2.25 : 2) + movementWater + Math.min(0.25, exerciseMinutes / 600)) * 4) / 4;
  const waterLiters = profile.waterGoalMode === 'manual' || needsReview || !activityKnown
    ? finite(profile.waterGoalLiters, 2, 1, 6) : estimatedWater;
  return {bmr: Math.round(bmr), measured, approximateSex, activityKnown, needsReview,
    maintenance: Math.round(maintenance), calories, waterLiters, exerciseMinutes};
}
export const mealBudget = (calories: number, meal: 'breakfast' | 'lunch' | 'snack' | 'dinner') =>
  Math.round(calories * ({breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3})[meal]);
