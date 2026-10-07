import {useState} from 'react';
import type {NutritionEntry, UserProfile} from '../types';
import type {ThemeColors} from '../services/theme';
import {getStoredWaterLogs} from '../services/storage';
import {nutritionTarget} from '../services/nutritionTarget';
import {dailyGoals, closedDays, closeDay} from '../services/dailyGoals';

export function DailyGoalsCard({profile, meals, date, theme}: {profile: UserProfile; meals: NutritionEntry[]; date: string; theme: ThemeColors}) {
  const [, refresh] = useState(0), [error, setError] = useState('');
  const target = nutritionTarget(profile);
  const day = dailyGoals(date, meals, getStoredWaterLogs(), target.calories, target.waterLiters);
  const ended = closedDays(localStorage, profile.id).includes(date);
  return <section aria-label="Mes objectifs du jour" className={`rounded-2xl border p-4 space-y-3 ${theme.cardBg} ${theme.cardBorder}`}>
    <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Mes objectifs du jour</h2><time className="text-xs text-slate-600 dark:text-slate-300" dateTime={date}>{new Date(date + 'T12:00:00').toLocaleDateString(profile.preferredLanguage)}</time></div>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div><span>Calories</span><strong className="block mt-1">{day.calories} kcal {target.needsReview ? '· Objectif à valider' : `/ ${target.calories} kcal`}</strong>{!target.needsReview && <progress aria-label="Calories du jour" className="mt-2 w-full h-2 accent-rose-600" value={Math.min(day.calories,target.calories)} max={target.calories}/>}</div>
      <div><span>Hydratation</span><strong className="block mt-1">{(day.waterMl/1000).toLocaleString(profile.preferredLanguage)} / {target.waterLiters.toLocaleString(profile.preferredLanguage)} L</strong><progress aria-label="Hydratation du jour" className="mt-2 w-full h-2 accent-cyan-600" value={Math.min(day.waterMl,target.waterLiters*1000)} max={target.waterLiters*1000}/></div>
    </div>
    {day.excess > 0 && !target.needsReview && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">{`🚨 Vous avez dépassé votre objectif quotidien de ${day.excess} kcal. Gardez des repas réguliers, sans sauter de repas pour compenser.`}</p>}
    {ended && <div role="status" className={`rounded-xl p-3 text-sm ${day.success && !target.needsReview ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'}`}>
      {day.success && !target.needsReview ? '🎉 Bravo ! Vous avez respecté vos objectifs de calories et d’hydratation aujourd’hui.' : target.needsReview ? 'Journée enregistrée. Validez vos objectifs avec votre professionnel de santé.' : day.excess > 0 ? 'Journée enregistrée. Demain est une nouvelle journée pour poursuivre votre objectif.' : !day.sufficientlyNourished ? 'Journée enregistrée. Vos calories sont sous le repère : vérifiez que tous vos repas sont notés. Manger trop peu n’est pas un objectif.' : 'Journée enregistrée. Votre objectif d’hydratation n’a pas été atteint.'}
    </div>}
    {target.needsReview && <p className="text-sm">Vos objectifs de calories et d’eau doivent être validés avec votre professionnel de santé.</p>}
    <button type="button" className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold" onClick={() => {try {closeDay(localStorage, profile.id, date, !ended); setError(''); refresh(n => n+1);} catch {setError('Impossible d’enregistrer le bilan. Libérez de l’espace puis réessayez.');}}}>{ended ? 'Modifier ma journée' : 'Terminer ma journée'}</button>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  </section>;
}
