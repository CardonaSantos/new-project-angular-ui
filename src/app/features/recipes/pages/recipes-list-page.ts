import {Component,computed,effect,inject,signal} from '@angular/core';
import {Router,ActivatedRoute,RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {firstValueFrom} from 'rxjs';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {RecipesApi} from '../data-access/recipes.api';
import {RecipesAccess} from '../data-access/recipes-access';
import {GcRecipesNav} from '../recipes-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {recipeDestination,recipeKind,recipePublished,readableQuantity} from '../data-access/recipes-presentation';
import type {RecipeKind,RecipePage,RecipeRecord} from '../data-access/recipes.models';

@Component({
 selector:'gc-recipes-list-page',imports:[GcRecipesNav,RouterLink,GcSearchSelect],
 template:`<main class="rec-page">
  <gc-recipes-nav/>
  <section class="rec-card">
   <div class="rec-top"><h2>Recetas</h2>
    @if(access.canManage()){<a class="rec-button rec-primary" routerLink="/recipes/list/new">Nueva receta</a>}
   </div>
   <div class="rec-filters" role="group" aria-label="Filtros de recetas">
    <label class="rec-field">Buscar por nombre
     <input [value]="search()" maxlength="120" placeholder="Buscar receta"
      (input)="search.set($any($event.target).value)" (keydown.enter)="$event.preventDefault();apply()"/>
    </label>
    <button type="button" (click)="apply()">Buscar</button>
    <gc-search-select id="recipes-filter-kind" label="Tipo" [items]="kindChoices"
     [value]="kind()" placeholder="Todas" [searchable]="false"
     (valueChange)="updateQuery({tipo:$event||null,page:null})"/>
   </div>
   @if(state.busy()){<p role="status" class="rec-muted">Cargando recetas…</p>}
   @if(state.status()==='error'){
    <p class="rec-alert" role="alert">{{message()}} <button type="button" (click)="reload()">Reintentar</button></p>
   }
   @if(state.data();as result){
    <div class="rec-table-wrap"><table class="rec-table">
     <thead><tr><th>Receta</th><th>Se utiliza en</th><th>Rendimiento</th><th>Estado</th><th></th></tr></thead>
     <tbody>
      @for(row of result.data;track row.id){
       <tr><td><strong>{{row.nombre}}</strong><div class="rec-muted">{{typeLabel(row.tipo)}}</div></td>
        <td>{{destination(row)}}</td>
        <td>@if(published(row);as v){ {{quantity(v.rendimiento,v.unidadRendimiento?.codigo)}} } @else {—}</td>
        <td>{{!row.activa?'Inactiva':published(row)?'Publicada':'Sin fórmula publicada'}}</td>
        <td><a class="rec-link" [routerLink]="['/recipes/list',row.id]">Detalles</a></td></tr>
      } @empty {<tr><td colspan="5">No hay recetas con estos filtros.</td></tr>}
     </tbody>
    </table></div>
    <div class="rec-top rec-muted">
     <span>{{result.meta.total}} recetas · Página {{currentPage()}} de {{result.meta.totalPages||1}}</span>
     <div class="rec-actions">
      <button type="button" [disabled]="currentPage()<=1" (click)="move(-1)">Anterior</button>
      <button type="button" [disabled]="currentPage()>=result.meta.totalPages" (click)="move(1)">Siguiente</button>
     </div>
    </div>
   }
  </section>
 </main>`,styleUrl:'../recipes.scss'
})
export class GcRecipesListPage {
 protected readonly access=inject(RecipesAccess);
 private readonly api=inject(RecipesApi);
 private readonly route=inject(ActivatedRoute);
 private readonly router=inject(Router);
 private readonly query=toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
 protected readonly state=new GcPageState<RecipePage<RecipeRecord>>();
 protected readonly search=signal('');
 protected readonly kindChoices=[
  {id:'VENTA',label:'Productos de la carta'},{id:'PRODUCCION',label:'Preparaciones de inventario'}
 ];
 protected readonly currentPage=computed(()=>Math.max(1,Number(this.query().get('page')??'1')||1));
 protected readonly kind=computed(()=>this.query().get('tipo')??'');
 protected readonly destination=recipeDestination;
 protected readonly published=recipePublished;
 protected readonly typeLabel=recipeKind;
 protected readonly quantity=readableQuantity;
 constructor(){effect(()=>{
  const page=this.currentPage(),kind=this.kind(),search=this.query().get('search')??'';
  this.search.set(search);
  void this.state.load(()=>firstValueFrom(this.api.list({
   page,limit:20,search,tipo:kind==='VENTA'||kind==='PRODUCCION'?kind as RecipeKind:undefined
  })));
 })}
 protected message(){return gcErrorMessage(this.state.error())}
 protected reload(){void this.state.load(()=>firstValueFrom(this.api.list({
  page:this.currentPage(),limit:20,search:this.query().get('search')??'',
  tipo:this.kind()==='VENTA'||this.kind()==='PRODUCCION'?this.kind() as RecipeKind:undefined
 })))}
 protected apply(){this.updateQuery({search:this.search().trim()||null,page:null})}
 protected move(n:number){this.updateQuery({page:String(Math.max(1,this.currentPage()+n))})}
 protected updateQuery(values:Record<string,string|null>){
  void this.router.navigate([],{relativeTo:this.route,queryParams:values,queryParamsHandling:'merge'})
 }
}
