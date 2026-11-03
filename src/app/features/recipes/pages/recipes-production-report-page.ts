import {Component,computed,effect,inject,signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {formatDecimal,formatCurrency} from '../../../shared/formatting';
import {RecipesApi} from '../data-access/recipes.api';
import {RecipesAccess} from '../data-access/recipes-access';
import type {ProductionReport} from '../data-access/recipes.models';
import {inclusiveBranchPeriod} from '../data-access/production-period';
import {GcRecipesNav} from '../recipes-nav';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';

@Component({
 selector:'gc-recipes-production-report-page',imports:[GcRecipesNav,GcSearchSelect],
 template:`<main class="rec-page">
 <gc-recipes-nav/>
 <section class="rec-card">
  <div class="rec-top"><h2>Reporte de producción</h2></div>
  <div class="rec-filters" role="group" aria-label="Filtros del reporte de producción">
   <gc-search-select id="production-report-branch" label="Sucursal" [items]="branchChoices()"
    [value]="branchId()" placeholder="Seleccionar sucursal" [clearable]="false"
    (valueChange)="branchId.set($event)"/>
   <label class="rec-field">Desde <input type="date" [value]="from()" (change)="from.set($any($event.target).value)"/></label>
   <label class="rec-field">Hasta (incluido) <input type="date" [value]="to()" (change)="to.set($any($event.target).value)"/></label>
   <button type="button" [disabled]="busy()||!branchId()" (click)="load()">Consultar</button>
  </div>
  @if(!branchId()){<p class="rec-note">Selecciona una sucursal para consultar los resultados.</p>}
  @if(busy()){<p class="rec-muted" role="status">Preparando el reporte…</p>}
  @if(error()){<p class="rec-alert" role="alert">{{error()}}</p>}
  @if(report();as r){
   <div class="rec-metrics"><div class="rec-metric">
    <strong>{{r.produccionesConfirmadas}}</strong><span>Producciones confirmadas</span></div>
    @if(r.costoTotal!==undefined&&access.canSeeCosts()){
     <div class="rec-metric"><strong>{{currency(r.costoTotal)}}</strong><span>Costo total</span></div>
    }
   </div>
   <div class="rec-table-wrap"><table class="rec-table">
    <thead><tr><th>Preparación</th><th>Cantidad producida</th>
    @if(r.costoTotal!==undefined&&access.canSeeCosts()){<th>Costo</th>}</tr></thead>
    <tbody>
     @for(a of r.articulos;track a.articuloId){
      <tr><td><strong>{{a.nombre}}</strong></td><td>{{decimal(a.cantidad)}} {{a.unidad}}</td>
       @if(r.costoTotal!==undefined&&access.canSeeCosts()){<td>{{a.costoTotal!==undefined?currency(a.costoTotal):'—'}}</td>}
      </tr>
     } @empty {<tr><td colspan="3">No hay producciones confirmadas para este período.</td></tr>}
    </tbody>
   </table></div>
  }
  <p class="rec-note">Los totales se calculan sobre producciones confirmadas, no sobre borradores ni recetas guardadas.</p>
 </section></main>`,styleUrl:'../recipes.scss'
})
export class GcRecipesProductionReportPage {
 protected readonly branch=inject(GcBranchContext);
 protected readonly branchChoices=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly access=inject(RecipesAccess);
 private readonly api=inject(RecipesApi);
 protected readonly branchId=signal('');
 protected readonly from=signal('');
 protected readonly to=signal('');
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly report=signal<ProductionReport|null>(null);
 protected readonly decimal=formatDecimal;
 protected readonly currency=formatCurrency;
 private gen=0;
 constructor(){effect(()=>{
  this.branchId();this.from();this.to();
  this.gen++;this.report.set(null);this.error.set(null);
 })}
 protected async load(){
  if(!this.branchId())return;
  const gen=++this.gen;
  this.busy.set(true);this.error.set(null);this.report.set(null);
  try{
   const timeZone=this.branch.branches().find(x=>x.id===this.branchId())?.zonaHoraria??'America/Guatemala';
   const r=await firstValueFrom(this.api.productionReport({sucursalId:this.branchId(),
    ...inclusiveBranchPeriod(this.from(),this.to(),timeZone)
   }));
   if(this.gen===gen)this.report.set(r);
   }catch(e){if(this.gen===gen)this.error.set(e instanceof Error&&!(e as {status?:number}).status?e.message:gcErrorMessage(e))}
  finally{if(this.gen===gen)this.busy.set(false)}
 }
}
