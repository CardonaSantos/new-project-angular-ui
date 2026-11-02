import {Component,computed,inject,signal,OnInit} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcCatalogNav} from '../catalog-nav';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import {PRODUCT_KINDS,type CatalogPriceCoverage,type CatalogSummary} from '../data-access/catalog.models';

@Component({
 selector:'gc-catalog-reports-page',imports:[GcCatalogNav,GcErrorState],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <section class="cat-card">
   <div class="cat-row"><h2>Estado de precios y productos</h2>
    <label class="cat-field">Sucursal
     <select [value]="branchId()" (change)="chooseBranch($any($event.target).value)">
      @for(branch of context.branches();track branch.id){
       <option [value]="branch.id">{{branch.nombre}}</option>
      }
     </select>
    </label>
   </div>
   <div class="cat-toolbar">
    <label class="cat-field">Consultar cobertura en fecha
     <input type="datetime-local" [value]="queryDate()"
      (change)="queryDate.set($any($event.target).value)"/>
    </label>
    <button type="button" [disabled]="busy()||!branchId()" (click)="reload()">Consultar</button>
    <button type="button" [disabled]="busy()" (click)="resetDate()">Ahora</button>
   </div>
   <p class="cat-muted">Los precios y la disponibilidad comercial se evalúan para la fecha consultada. La fecha se introduce en la hora de este equipo.</p>
   @if(busy()){<p role="status" class="cat-muted">Generando reporte…</p>}
   @if(error()){<gc-error-state [message]="error()!" (retry)="reload()"/>}
  </section>
  @if(coverage();as report){
   @if(report.autorizada===false){
    <section class="cat-card"><p class="cat-alert">No tienes acceso al reporte de esta sucursal.</p></section>
   } @else {
    <section class="cat-card">
     <h2>{{report.nombre??'Sucursal seleccionada'}}</h2>
     <div class="cat-metrics">
      <div class="cat-metric"><strong>{{report.variantesVisibles??0}}</strong><span>Presentaciones disponibles</span></div>
      <div class="cat-metric"><strong>{{report.conPrecio??0}}</strong><span>Con precio actualizado</span></div>
      <div class="cat-metric"><strong>{{report.sinPrecio??0}}</strong><span>Sin precio actualizado</span></div>
      <div class="cat-metric"><strong>{{report.vendiblesPorPrecioYEstado??0}}</strong><span>Disponibles para la venta</span></div>
      <div class="cat-metric"><strong>{{report.menusPublicados??0}}</strong><span>Menús publicados</span></div>
      <div class="cat-metric"><strong>{{report.productosConImagen??0}}</strong><span>Productos con fotografía</span></div>
     </div>
     @if((report.sinPrecio??0)>0){
      <p class="cat-alert" role="status">Hay presentaciones sin precio para esta sucursal. Revisa la sección «Precios» antes de publicar un menú.</p>
     }
     <p class="cat-muted">Estos datos muestran la oferta comercial. Consulta las existencias antes de confirmar las ventas.</p>
    </section>
   }
  }
  @if(summary();as overview){
   <section class="cat-card">
    <h2>Resumen general del catálogo</h2>
    <div class="cat-metrics">
     <div class="cat-metric"><strong>{{overview.categoriasActivas}}</strong><span>Categorías activas</span></div>
     <div class="cat-metric"><strong>{{overview.productosActivos}}</strong><span>Productos activos</span></div>
     <div class="cat-metric"><strong>{{overview.variantesActivas}}</strong><span>Variantes activas</span></div>
     <div class="cat-metric"><strong>{{overview.gruposActivos}}</strong><span>Grupos de extras</span></div>
     <div class="cat-metric"><strong>{{overview.modificadoresActivos}}</strong><span>Extras activos</span></div>
     <div class="cat-metric"><strong>{{overview.productosSinImagen}}</strong><span>Productos sin fotografía</span></div>
    </div>
    @if(overview.productosPorTipo.length){
     <div class="cat-table-wrap"><table class="cat-table">
      <thead><tr><th>Tipo comercial</th><th>Productos</th></tr></thead><tbody>
       @for(item of overview.productosPorTipo;track item.tipo){
        <tr><td>{{typeLabel(item.tipo)}}</td><td>{{item.cantidad}}</td></tr>
       }
      </tbody>
     </table></div>
    }
    <p class="cat-muted">Este reporte todavía no incluye las ventas ni las ganancias.</p>
   </section>
  }
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogReportsPage implements OnInit{
 protected readonly access=inject(CatalogAccess);
 protected readonly context=inject(GcBranchContext);
 private readonly api=inject(CatalogApi);
 protected readonly branchId=signal('');
 protected readonly queryDate=signal('');
 protected readonly summary=signal<CatalogSummary|null>(null);
 protected readonly coverage=signal<CatalogPriceCoverage|null>(null);
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly canQuery=computed(()=>this.access.canReports()&&!!this.branchId());
 private requestGeneration=0;
 ngOnInit(){this.branchId.set(this.context.branchId()??this.context.branches()[0]?.id??'');void this.reload()}
 protected chooseBranch(id:string){this.branchId.set(id);void this.reload()}
 protected resetDate(){this.queryDate.set('');void this.reload()}
 protected typeLabel(value:string){return PRODUCT_KINDS.find(x=>x.value===value)?.label??'Otro tipo'}
 private dateIso(){
  if(!this.queryDate())return undefined;
  const parsed=new Date(this.queryDate());
  if(!Number.isFinite(parsed.getTime()))throw new Error('Fecha de consulta inválida.');
  return parsed.toISOString();
 }
 protected async reload(){
  if(!this.canQuery())return;
  const generation=++this.requestGeneration;
  this.busy.set(true);this.error.set(null);this.coverage.set(null);this.summary.set(null);
  try{
   const branch=this.branchId(),date=this.dateIso();
   const [coverage,summary]=await Promise.all([
    firstValueFrom(this.api.priceCoverage(branch,date)),
    firstValueFrom(this.api.summary(branch))
   ]);
   if(generation===this.requestGeneration){
    this.coverage.set(coverage);this.summary.set(summary);
   }
  }catch(e){
   if(generation===this.requestGeneration)this.error.set(gcErrorMessage(e));
  }finally{if(generation===this.requestGeneration)this.busy.set(false)}
 }
}
