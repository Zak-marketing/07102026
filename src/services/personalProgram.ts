import type {UserProfile} from '../types';
import {nutritionTarget,mealBudget} from './nutritionTarget';

export function personalProgram(profile: UserProfile, measuredBmr?: number) {
  const target=nutritionTarget(profile,measuredBmr), goal=profile.weightGoal || 'lose';
  // One illustrative distribution inside adult macronutrient reference ranges.
  // It does not infer hormonal status or prescribe supplements from an InBody scan.
  const proteinShare=goal==='gain' || target.exerciseMinutes>=150 ? 0.25 : 0.2;
  const proteinsG=Math.round(target.calories*proteinShare/4),fatsG=Math.round(target.calories*0.3/9);
  const carbsG=Math.round((target.calories-proteinsG*4-fatsG*9)/4);
  const split=[
    {type:'breakfast' as const,meal:'Matin',description:'Fruits, céréales complètes et yaourt ou une alternative adaptée à votre alimentation.'},
    {type:'lunch' as const,meal:'Midi',description:'Légumes, féculents et une source de protéines : légumineuses, œufs, poisson ou volaille au choix.'},
    {type:'snack' as const,meal:'Pause après-midi',description:goal==='gain'?'Une collation nourrissante : fruit, yaourt et noix selon vos préférences et tolérances.':'Une collation selon votre faim : fruit et yaourt ou une alternative adaptée.'},
    {type:'dinner' as const,meal:'Soir',description:'Légumes, protéines au choix et féculents. Ajustez les quantités dans le composeur.'}
  ];
  const mealPlan=target.needsReview?[]:split.map(item=>({meal:item.meal,description:item.description,calories:mealBudget(target.calories,item.type),macros:'Budget indicatif du repas, à répartir entre les aliments choisis.'}));
  const workoutPlan=target.needsReview?[]:[
    {focus:'Activité modérée',frequency:target.exerciseMinutes<60?'10 minutes, 5 jours par semaine pour commencer':'Vers 150 minutes par semaine, réparties à votre rythme',description:'Commencez à votre niveau et augmentez progressivement si vous le pouvez.',exercises:['Marche à une allure confortable, puis plus soutenue','Vélo ou autre activité que vous appréciez']},
    {focus:'Renforcement adapté',frequency:'Progressivement, 2 jours par semaine',description:goal==='gain'?'Associez la prise de poids progressive à un renforcement adapté à vos capacités.':'Préservez votre force avec des exercices adaptés à vos capacités.',exercises:['Mouvements simples pour les jambes, le dos et les bras','Choisissez une difficulté confortable, sans douleur']},
    {focus:'Mouvement quotidien',frequency:profile.dailyActivity==='seated'?'Petites pauses régulières durant la journée':'Chaque jour, en tenant compte du travail physique',description:'Alternez les positions, gardez du temps pour récupérer et buvez régulièrement.',exercises:['Interrompez les longues périodes assises','Prévoyez des journées de récupération selon votre fatigue']}
  ];
  const strategy=target.needsReview?'Votre situation nécessite des objectifs validés avec votre professionnel de santé. Aucun programme de déficit ou de surplus automatique n’est proposé.':goal==='gain'?'Repère de prise progressive : environ 300 kcal en plus de la dépense estimée, avec des repas réguliers.':goal==='maintain'?'Repère de stabilisation : calories proches de votre dépense estimée. Ajustez les portions selon la tendance du poids.':'Repère de perte progressive : réduction modérée des calories, repas réguliers et activité adaptée.';
  const maintenanceAdvice='Une fois l’objectif atteint, choisissez la stabilisation. Observez la tendance du poids et adaptez progressivement les portions. L’eau corporelle InBody ne correspond pas à la quantité à boire.';
  const medicalNotice='Ces repères sont estimatifs. Les calories affichées pour les repas sont des budgets, pas le calcul exact des exemples proposés. En cas de grossesse, de maladie ou de consignes médicales, adaptez l’alimentation, l’eau et le sport avec votre professionnel de santé.';
  return {...target,proteinsG,fatsG,carbsG,mealPlan,workoutPlan,strategy,maintenanceAdvice,medicalNotice};
}
