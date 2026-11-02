import {Component,inject} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
import {RecipesAccess} from './data-access/recipes-access';
@Component({
 selector:'gc-recipes-nav',imports:[RouterLink,RouterLinkActive],
 template:`<nav class="rec-nav" aria-label="Secciones de recetas">
  <a routerLink="/recipes/summary" routerLinkActive="active" ariaCurrentWhenActive="page">Resumen</a>
  @if(access.canRead()){
   <a routerLink="/recipes/list" routerLinkActive="active" ariaCurrentWhenActive="page">Recetas</a>
   <a routerLink="/recipes/extras" routerLinkActive="active" ariaCurrentWhenActive="page">Extras</a>
   <a routerLink="/recipes/packaging" routerLinkActive="active" ariaCurrentWhenActive="page">Empaques</a>
  }
  @if(access.canProductionRead()){
   <a routerLink="/recipes/production" routerLinkActive="active" ariaCurrentWhenActive="page">Producción</a>
   <a routerLink="/recipes/reports" routerLinkActive="active" ariaCurrentWhenActive="page">Reportes</a>
  }
 </nav>`,styleUrl:'./recipes.scss'
})
export class GcRecipesNav {protected readonly access=inject(RecipesAccess)}
