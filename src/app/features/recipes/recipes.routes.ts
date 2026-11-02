import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';
export const RECIPES_ROUTES:Routes=[
 {path:'',pathMatch:'full',redirectTo:'summary'},
 {path:'summary',title:'Resumen de recetas — Gastro Core',data:{breadcrumb:'Resumen'},
  loadComponent:()=>import('./pages/recipes-summary-page').then(x=>x.GcRecipesSummaryPage)},
 {path:'list',data:{breadcrumb:'Recetas'},children:[
  {path:'',pathMatch:'full',title:'Recetas — Gastro Core',
   loadComponent:()=>import('./pages/recipes-list-page').then(x=>x.GcRecipesListPage)},
  {path:'new',title:'Nueva receta — Gastro Core',data:{breadcrumb:'Nueva'},
   canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/recipes-detail-page').then(x=>x.GcRecipesDetailPage)},
  {path:':id',title:'Detalle de receta — Gastro Core',data:{breadcrumb:'Detalle'},
   canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/recipes-detail-page').then(x=>x.GcRecipesDetailPage)}
 ]},
 {path:'extras',title:'Composición de extras — Gastro Core',data:{breadcrumb:'Extras'},
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/recipes-extras-page').then(x=>x.GcRecipesExtrasPage)},
 {path:'packaging',title:'Reglas de empaque — Gastro Core',data:{breadcrumb:'Empaques'},
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/recipes-packaging-page').then(x=>x.GcRecipesPackagingPage)}
];
