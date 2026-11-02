import {Component,inject,signal,computed} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {formatDecimal,formatCurrency} from '../../../shared/formatting';
import {RecipesApi} from '../data-access/recipes.api';
import {RecipesAccess} from '../data-access/recipes-access';
import type {ProductionReport} from '../data-access/recipes.models';
import {GcRecipesNav} from '../recipes-nav';

@Component({
 selector:'gc-recipes-production-report-page',imports:[GcRecipesNav],
 template:`<main class="rec-page">
 <gc-recipes-nav/>
 <section class="rec-card">
  <div class="rec-top"><h2>Reporte de producción</h2></div>
  <div class="rec-filters">
   <label class="rec-field">Sucursal
    <select [value]="branchId()" (change)="branchId.set($any($event.target).value)">
     <option value="">Seleccionar sucursal</option>
     @for(b of branch.branches();track b.id){<option [value]="b.id" [selected]="b.id===branchId()">{{b.nombre}}</option>}
    </select></label>
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
 protected async load(){
  if(!this.branchId())return;
  const gen=++this.gen;
  this.busy.set(true);this.error.set(null);this.report.set(null);
  try{
   const r=await firstValueFrom(this.api.productionReport({sucursalId:this.branchId(),
    ...(this.from()?{fechaDesde:new Date(this.from()+'T00:00:00').toISOString()}:{}),
    ...(this.to()?{fechaHasta:new Date(new Date(this.to()+'T00:00:00').getTime()+86400000).toISOString()}:{}),
   }));
   if(this.gen===gen)this.report.set(r);
  }catch(e){if(this.gen===gen)this.error.set(gcErrorMessage(e))}
  finally{if(this.gen===gen)this.busy.set(false)}
 }
}
