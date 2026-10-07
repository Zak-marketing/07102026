import type { DailyActivity, UserProfile } from '../types';

export function ActivityQuestions({value, onChange}: {value: Partial<UserProfile>; onChange: (value: Partial<UserProfile>) => void}) {
  const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
  return <div className="space-y-4">
    <label className="block text-sm font-semibold">Sexe utilisé pour estimer le métabolisme
      <select className={input} value={value.metabolismSex || 'unspecified'} onChange={e => onChange({metabolismSex: e.target.value as UserProfile['metabolismSex']})}>
        <option value="unspecified">Je préfère ne pas préciser</option><option value="female">Femme</option><option value="male">Homme</option>
      </select>
      <small className="block mt-1 font-normal text-slate-600 dark:text-slate-300">Sans cette information, l’estimation est moins précise.</small>
    </label>
    <label className="block text-sm font-semibold">Votre journée habituelle, hors sport
      <select className={input} value={value.dailyActivity || 'mixed'} onChange={e => onChange({dailyActivity: e.target.value as DailyActivity})}>
        <option value="seated">Principalement assis, peu de déplacements</option><option value="mixed">Assis et debout, quelques déplacements</option><option value="moving">Souvent debout, beaucoup de marche</option><option value="physical">Travail physique, mouvements soutenus</option>
      </select>
    </label>
    <label className="block text-sm font-semibold">Combien de sport modéré par semaine ?
      <select className={input} value={value.exerciseMinutesPerWeek || 0} onChange={e => onChange({exerciseMinutesPerWeek: Number(e.target.value)})}>
        <option value={0}>Je ne fais pas de sport actuellement</option><option value={60}>Environ 1 heure</option><option value={150}>Environ 2 h 30</option><option value={300}>Environ 5 heures</option><option value={450}>Environ 7 h 30</option><option value={600}>Environ 10 heures</option>
      </select>
      <small className="block mt-1 font-normal text-slate-600 dark:text-slate-300">Marche rapide, vélo ou sport à intensité modérée, en plus des déplacements habituels.</small>
    </label>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={!!value.needsProfessionalPlan} onChange={e => onChange({needsProfessionalPlan: e.target.checked})}/><span>Grossesse, allaitement ou consignes médicales particulières pour l’alimentation, l’eau ou le sport.<small className="mt-1 block text-slate-600 dark:text-slate-300">Si oui, vos objectifs doivent être validés avec votre professionnel de santé.</small></span></label>
  </div>;
}
