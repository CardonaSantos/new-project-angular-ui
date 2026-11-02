import {Component,effect,inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {CatalogApi} from '../data-access/catalog.api';
import {GcCatalogNav} from '../catalog-nav';
import {CatalogAccess} from '../data-access/catalog-access';
import {PRODUCT_KINDS,type CatalogSummary,type CatalogPriceCoverage} from '../data-access/catalog.models';

interface Overview{summary:CatalogSummary;coverage:CatalogPriceCoverage|null}

@Component({
 selector:'gc-catalog-summary-page',
 imports:[GcPageHeader,GcErrorState,GcCatalogNav],
 template:`
  <main class="cat-page">
   <gc-page-header title="Catálogo comercial" description="Configuración comercial y cobertura por sucursal"/>
   <gc-catalog-nav/>
   <section class="cat-card">
    <div class="cat-row">
     <h2>Estado del catálogo</h2>
     <div class="cat-field">
      <label for="catalog-branch">Sucursal seleccionada</label>
      <select id="catalog-branch" [value]="branch.branchId()??''" (change)="chooseBranch($any($event.target).value)">
       @for(item of branch.branches();track item.id){
        <option [value]="item.id" [selected]="item.id===branch.branchId()">{{item.nombre}}</option>
       }
      </select>
     </div>
    </div>
    @if(!access.canReports()){
     <p class="cat-muted">No tienes permiso para consultar los reportes comerciales. La gestión de productos depende de tus permisos de catálogo.</p>
    } @else {
     @if(page.busy()){<p role="status" class="cat-muted">Consultando catálogo…</p>}
     @if(page.status()==='error'){
      <gc-error-state [message]="error()" (retry)="reload()"/>
     }
     @if(page.data();as response){
      <div class="cat-metrics">
       <div class="cat-metric"><strong>{{response.summary.productosActivos}}</strong><span>Productos activos</span></div>
       <div class="cat-metric"><strong>{{response.summary.variantesActivas}}</strong><span>Presentaciones activas</span></div>
       <div class="cat-metric"><strong>{{response.summary.menusPublicados}}</strong><span>Menús publicados</span></div>
       <div class="cat-metric"><strong>{{response.summary.productosSinImagen}}</strong><span>Productos sin fotografía</span></div>
      </div>
      @if(response.coverage;as coverage){
       <h2>Precios y disponibilidad comercial</h2>
       <div class="cat-metrics">
        <div class="cat-metric"><strong>{{coverage.conPrecio??0}}</strong><span>Presentaciones con precio</span></div>
        <div class="cat-metric"><strong>{{coverage.sinPrecio??0}}</strong><span>Presentaciones sin precio</span></div>
        <div class="cat-metric"><strong>{{coverage.vendiblesPorPrecioYEstado??0}}</strong><span>Disponibles para la venta</span></div>
       </div>
       <p class="cat-muted">Antes de aceptar una venta, revisa las existencias y los ingredientes disponibles.</p>
      }
      @if(response.summary.productosPorTipo.length){
       <h2>Productos por tipo</h2>
       <ul class="cat-list">
        @for(item of response.summary.productosPorTipo;track item.tipo){
         <li><span>{{kindLabel(item.tipo)}}</span><strong>{{item.cantidad}}</strong></li>
        }
       </ul>
      }
      <p class="cat-muted">Este resumen no incluye las ventas ni las ganancias.</p>
     }
    }
   </section>
  </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogSummaryPage {
 protected readonly access=inject(CatalogAccess);
 protected readonly branch=inject(GcBranchContext);
 private readonly api=inject(CatalogApi);
 protected readonly page=new GcPageState<Overview>();
 private readonly types=PRODUCT_KINDS;
 constructor(){
  effect(()=>{
   const id=this.branch.branchId();
   if(this.access.canReports())void this.load(id??undefined);
  });
 }
 protected kindLabel(v:string){return this.types.find(k=>k.value===v)?.label??'Otro tipo'}
 protected error(){return gcErrorMessage(this.page.error())}
 protected reload(){void this.load(this.branch.branchId()??undefined)}
 protected chooseBranch(id:string){void this.branch.select(id||null).subscribe()}
 private async load(sucursalId?:string){
  await this.page.load(async()=>{
   const summary=await firstValueFrom(this.api.summary(sucursalId));
   // Coverage is embedded in summary; avoid a duplicate HTTP request.
   const coverage=summary.sucursales.find(x=>x.sucursalId===sucursalId)??null;
   return {summary,coverage};
  });
 }
}
