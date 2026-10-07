import type {UserProfile} from '../types';
import type {ThemeColors} from '../services/theme';
import {mealBudget, nutritionTarget} from '../services/nutritionTarget';

export function NutritionAdvice({profile, theme, onEdit}: {profile: UserProfile; theme: ThemeColors; onEdit: () => void}) {
  const plan = nutritionTarget(profile), goal = profile.weightGoal || 'lose';
  return <details className={`rounded-2xl border p-4 space-y-3 ${theme.cardBg} ${theme.cardBorder}`}>
    <summary className="cursor-pointer font-bold">{plan.needsReview ? 'Mon programme · Objectifs à valider' : `Mon programme nutrition et activité · ${plan.calories} kcal · ${plan.waterLiters} L`}</summary>
    <div className="mt-4 space-y-4 text-sm">
      <p>{plan.needsReview ? 'Votre situation nécessite un programme personnalisé validé par un professionnel. Aucun déficit ou surplus automatique n’est proposé.' : goal === 'lose' ? 'Votre repère prévoit une réduction modérée des calories pour une perte progressive, avec des repas réguliers.' : goal === 'gain' ? 'Votre repère prévoit environ 300 kcal supplémentaires pour une prise progressive. Ajoutez une collation nourrissante et gardez vos repas réguliers.' : 'Votre repère vise le maintien du poids. Gardez des repas réguliers et ajustez les portions selon votre évolution.'}</p>
      <p>Métabolisme au repos : environ {plan.bmr} kcal. Dépense quotidienne estimée : {plan.maintenance} kcal.</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">{plan.measured ? 'Le métabolisme au repos provient du dernier relevé InBody.' : 'Le métabolisme au repos est estimé à partir de votre poids, taille, âge et sexe de calcul.'} {plan.activityKnown ? 'L’activité quotidienne et le sport renseignés sont pris en compte.' : 'Précisez votre activité pour affiner ces repères.'} Les besoins réels peuvent varier : ces chiffres ne sont pas une prescription.</p>
      {!plan.needsReview && <>
        <h3 className="font-bold">Répartir mes repas</h3>
        <div className="grid grid-cols-2 gap-2"><p>Matin · {mealBudget(plan.calories,'breakfast')} kcal</p><p>Midi · {mealBudget(plan.calories,'lunch')} kcal</p><p>Pause après-midi · {mealBudget(plan.calories,'snack')} kcal</p><p>Soir · {mealBudget(plan.calories,'dinner')} kcal</p></div>
        <p>À chaque repas, associez des légumes ou fruits, une source de protéines et des féculents adaptés à votre faim. Les quantités du composeur sont modifiables.</p>
        <p>{goal === 'gain' ? 'Pour enrichir vos repas : ajoutez selon vos préférences des noix, du yaourt, de l’huile d’olive ou une portion supplémentaire de féculents.' : goal === 'maintain' ? 'Pour stabiliser : conservez des portions régulières et observez la tendance du poids sur plusieurs semaines.' : 'Pour perdre progressivement : privilégiez des aliments rassasiants et adaptez les portions, sans supprimer un groupe d’aliments.'}</p>
        <h3 className="font-bold">Bouger à mon rythme</h3>
        <p>{plan.exerciseMinutes < 60 ? 'Commencez par 10 minutes de marche, 5 jours par semaine, puis augmentez progressivement si vous le pouvez.' : plan.exerciseMinutes < 150 ? 'Augmentez progressivement la marche ou le vélo vers 150 minutes d’activité modérée par semaine.' : 'Gardez au moins 150 minutes d’activité modérée par semaine, réparties selon vos disponibilités.'}</p>
        <p>Ajoutez progressivement 2 séances de renforcement par semaine adaptées à vos capacités. Interrompez régulièrement les longues périodes assises.</p>
        <p>Buvez régulièrement. Le repère d’eau peut être ajusté selon la soif, la chaleur et la transpiration. Un objectif manuel reste prioritaire.</p>
      </>}
      <button type="button" className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 font-semibold" onClick={onEdit}>Adapter mon activité et mes objectifs</button>
    </div>
  </details>;
}
