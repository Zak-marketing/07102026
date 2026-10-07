import {useEffect,useRef,useState} from 'react';
import type {NutritionEntry,UserProfile} from '../types';
import {dailyGoals} from '../services/dailyGoals';
import {nutritionTarget} from '../services/nutritionTarget';

// A meal can be entered below the daily summary. Keep an over-limit alert visible
// without scrolling the user away from the quantity field they are editing.
export function CalorieLimitAlert({profile,meals,date}:{profile:UserProfile;meals:NutritionEntry[];date:string}) {
  const target=nutritionTarget(profile);
  const day=dailyGoals(date,meals,[],target.calories,0);
  const previous=useRef({date,calories:day.calories,excess:day.excess});const [visible,setVisible]=useState(false);
  useEffect(()=>{if(previous.current.date!==date || day.excess===0)setVisible(false);else if(day.excess>previous.current.excess && day.excess>0)setVisible(true);previous.current={date,calories:day.calories,excess:day.excess};},[date,day.calories,day.excess]);
  if(!visible || day.excess===0 || target.needsReview)return null;
  return <aside role="alert" className="fixed z-40 bottom-4 left-3 right-3 mx-auto max-w-lg rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-xl dark:border-red-700 dark:bg-red-950 dark:text-red-100" style={{marginBottom:'env(safe-area-inset-bottom)'}}>
    <div className="flex items-start gap-3"><p className="flex-1 text-sm font-semibold">{`🚨 Objectif quotidien dépassé de ${day.excess} kcal. Gardez des repas réguliers et reprenez votre rythme habituel demain.`}</p><button type="button" className="rounded-lg border border-red-300 p-2 text-sm" aria-label="Fermer l’alerte de calories" onClick={()=>setVisible(false)}>×</button></div>
  </aside>;
}
