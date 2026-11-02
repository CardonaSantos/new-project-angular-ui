
import {Component,computed,effect,inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcInventoryNav} from '../inventory-nav';
import {InventoryApi} from '../data-access/inventory.api';
import {InventoryUrlState} from '../data-access/inventory-url-state';
import {parseApiDecimal,formatDecimal} from '../../../shared/formatting';
import type {StockSummary} from '../data-access/inventory.models';
@Component({
 selector:'gc-inventory-summary-page',
 providers:[InventoryUrlState],
 imports:[RouterLink,GcPageHeader,GcInventoryNav,GcErrorState],
 template:`
 <div class="inv-page">
  <gc-page-header title="Resumen de inventario"
   description="Existencias físicas y situaciones que requieren atención"/>
  <gc-inventory-nav/>
  <section class="inv-card">
   <div class="inv-row">
    <h2>Sucursal</h2>
    <div class="inv-field">
     <label for="overview-branch">Consultar sucursal</label>
     <select id="overview-branch" [value]="url.filters().sucursalId"
       (change)="selectBranch($any($event.target).value)">
      @for(item of branch.branches();track item.id){<option [value]="item.id">{{item.nombre}}</option>}
     </select>
    </div>
   </div>
   @if(page.busy()){<p role="status" class="inv-muted">Cargando existencias…</p>}
   @if(page.status()==='error'){<gc-error-state [message]="gcError()" (retry)="reload()"/>}
   @if(page.data();as result){
    <div class="inv-metrics">
     <div class="inv-metric"><strong>{{result.data.length}}</strong><span>Artículos con posiciones</span></div>
     <div class="inv-metric"><strong>{{low().length}}</strong><span>Por debajo del mínimo</span></div>
     <div class="inv-metric"><strong>{{blocked().length}}</strong><span>Con existencias bloqueadas</span></div>
    </div>
    <div class="inv-row">
     <p class="inv-muted">{{result.nota}}</p>
     <a routerLink="/inventory/stock" class="inv-link">Ver todas las existencias</a>
    </div>
   }
  </section>
  @if(low().length){
   <section class="inv-card">
    <div class="inv-row">
     <h2>Bajo el mínimo</h2>
     <a routerLink="/inventory/stock" class="inv-link">Abrir existencias</a>
    </div>
    @for(item of low().slice(0,12);track item.articuloId){
     <div class="inv-row">
      <div class="inv-stack">
       <strong>{{item.nombre}}</strong><span class="inv-muted">{{item.codigo}}</span>
      </div>
      <div><strong>{{quantity(item.cantidad)}}</strong>
       <span class="inv-muted"> {{item.unidad}} · mínimo {{quantity(item.stockMinimo)}}</span></div>
     </div>
    }
   </section>
  }
  <section class="inv-card">
   <h2>Accesos rápidos</h2>
   <nav class="inv-subnav" aria-label="Acciones de inventario">
    <a routerLink="/inventory/articles">Artículos</a>
    <a routerLink="/inventory/stock/lots">Lotes</a>
    <a routerLink="/inventory/operations/counts">Conteos</a>
    <a routerLink="/inventory/operations/transfers">Transferencias</a>
    <a routerLink="/inventory/reports">Reportes</a>
   </nav>
  </section>
 </div>`,
 styleUrl:'../inventory.scss'
})
export class GcInventorySummaryPage{
 protected readonly branch=inject(GcBranchContext);
 protected readonly url=inject(InventoryUrlState);
 private readonly api=inject(InventoryApi);
 protected readonly page=new GcPageState<{data:StockSummary[];nota?:string}>();
 protected readonly low=computed(()=>this.page.data()?.data.filter(x=>this.isLow(x))??[]);
 protected readonly blocked=computed(()=>this.page.data()?.data.filter(x=>this.hasBlocked(x))??[]);
 constructor(){effect(()=>{const id=this.url.filters().sucursalId;if(id)void this.load(id)})}
 protected selectBranch(id:string){void this.url.patch({sucursalId:id})}
 protected quantity(v:string|null|undefined){try{return v?formatDecimal(v):'0'}catch{return '—'}}
 protected isLow(item:StockSummary){return item.bajoMinimo===true}
 protected hasBlocked(item:StockSummary){
  try{return parseApiDecimal(item.cantidadBloqueada??'0').greaterThan(0)}catch{return false}
 }
 protected gcError(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load(this.url.filters().sucursalId)}
 private async load(id:string){await this.page.load(()=>firstValueFrom(this.api.summary({sucursalId:id})))}
}
