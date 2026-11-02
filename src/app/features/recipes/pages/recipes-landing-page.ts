import {Component,effect,inject} from '@angular/core';
import {Router} from '@angular/router';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import {RecipesAccess} from '../data-access/recipes-access';

@Component({
 selector:'gc-recipes-landing-page',
 template:`<main class="rec-page"><p class="rec-muted" role="status">Abriendo recetas y producción…</p></main>`,
 styleUrl:'../recipes.scss'
})
export class GcRecipesLandingPage {
 private readonly router=inject(Router);
 private readonly access=inject(RecipesAccess);
 private readonly org=inject(OrganizationAccess);
 private readonly branches=inject(GcBranchContext);
 constructor(){effect(()=>{
  // Wait for capabilities; production permissions may be branch-scoped.
  const loaded=this.org.loaded(),loading=this.branches.loading();
  if(!loaded||loading)return;
  const url=this.access.canRead()?'/recipes/summary':
   this.access.canProductionRead()?'/recipes/production':
   this.access.canProduce()?'/recipes/production/new':'/workspace';
  void this.router.navigateByUrl(url,{replaceUrl:true});
 })}
}
