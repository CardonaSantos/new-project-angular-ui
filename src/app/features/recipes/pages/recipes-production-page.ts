import {Component,computed,effect,inject,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {formatInstant,formatDecimal} from '../../../shared/formatting';
import {RecipesApi} from '../data-access/recipes.api';
import {RecipesAccess} from '../data-access/recipes-access';
import type {RecipePage,ProductionListItem} from '../data-access/recipes.models';
import {inclusiveBranchPeriod} from '../data-access/production-period';
import {GcRecipesNav} from '../recipes-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';

@Component({
 selector:'gc-recipes-production-page',imports:[GcRecipesNav,RouterLink,GcSearchSelect],
 template:`<main class="rec-page">
  <gc-recipes-nav/>
  <section class="rec-card">
   <div class="rec-top"><h2>Producciones</h2>
    @if(access.canProduce()){<a routerLink="/recipes/production/new" class="rec-button rec-primary">Registrar producción</a>}
   </div>

   <div class="rec-filters" role="group" aria-label="Filtros de producción">
    <gc-search-select id="production-filter-branch" label="Sucursal" [items]="branchChoices()"
     [value]="branchId()" placeholder="Seleccionar sucursal" [clearable]="false"
     (valueChange)="branchId.set($event);page.set(1)"/>
    <label class="rec-field">Desde
     <input type="date" [value]="from()" (change)="from.set($any($event.target).value);page.set(1)"/>
    </label>
    <label class="rec-field">Hasta (incluido)
     <input type="date" [value]="to()" (change)="to.set($any($event.target).value);page.set(1)"/>
    </label>
    <button type="button" (click)="reload()" [disabled]="busy()">Actualizar</button>
   </div>
   @if(!branchId()){<p class="rec-note">Selecciona una sucursal para consultar sus producciones.</p>}
   @if(state.busy()){<p class="rec-muted" role="status">Cargando producciones…</p>}
   @if(state.status()==='error'){<p class="rec-alert" role="alert">
    {{gcError(state.error())}} <button type="button" (click)="reload()">Reintentar</button></p>}
   @if(state.data();as result){
    <div class="rec-table-wrap"><table class="rec-table">
     <thead><tr><th>Preparación</th><th>Cantidad</th><th>Ubicación</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
     <tbody>
      @for(item of result.data;track item.id){
       <tr><td><strong>{{item.receta}}</strong><div class="rec-muted">{{item.articuloResultado?.nombre??'Preparación'}}</div></td>
       <td>{{decimal(item.cantidadProducida)}} {{item.unidadResultado?.codigo??''}}</td>
       <td>{{item.ubicacion}}</td>
       <td>{{date(item.creadoEn)}}</td>
       <td>{{item.estado==='BORRADOR'?'Pendiente':item.estado==='CONFIRMADA'?'Confirmada':'Cancelada'}}</td>
       <td><a class="rec-link" [routerLink]="['/recipes/production',item.id]">Detalles</a></td></tr>
      } @empty {<tr><td colspan="6">No hay producciones en este período.</td></tr>}
     </tbody></table></div>
    <div class="rec-top rec-muted"><span>{{result.meta.total}} registros · Página {{page()}}</span>
     <div class="rec-actions">
      <button type="button" [disabled]="page()<=1" (click)="page.update(x=>x-1)">Anterior</button>
      <button type="button" [disabled]="page()>=result.meta.totalPages" (click)="page.update(x=>x+1)">Siguiente</button>
     </div>
    </div>
   }
  </section>
 </main>`,styleUrl:'../recipes.scss'
})
export class GcRecipesProductionPage {
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly access=inject(RecipesAccess);
 private readonly api=inject(RecipesApi);
 protected readonly branchId=signal('');
 protected readonly from=signal('');
 protected readonly to=signal('');
 protected readonly page=signal(1);
 protected readonly state=new GcPageState<RecipePage<ProductionListItem>>();
 protected readonly busy=computed(()=>this.state.busy());
 protected readonly decimal=formatDecimal;
 protected readonly date=(value:string)=>formatInstant(value,
  this.branch.branches().find(x=>x.id===this.branchId())?.zonaHoraria??'America/Guatemala');
 protected readonly gcError=gcErrorMessage;
 private readonly token=signal(0);
 constructor(){effect(()=>{
  const id=this.branchId(),pg=this.page(),from=this.from(),to=this.to();
  this.token();
  if(!id){this.state.reset();return}
  void this.state.load(()=>firstValueFrom(this.api.productionList({
   sucursalId:id,page:pg,limit:20,
   ...inclusiveBranchPeriod(from,to,
    this.branch.branches().find(x=>x.id===id)?.zonaHoraria??'America/Guatemala')
  })));
 })}
 protected reload(){this.token.update(n=>n+1)}
}
