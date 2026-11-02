import {Component,computed,inject,signal,OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {formatCurrency} from '../../../shared/formatting';
import {GcCatalogNav} from '../catalog-nav';
import {CatalogApi} from '../data-access/catalog.api';
import {CatalogAccess} from '../data-access/catalog-access';
import type {CatalogBranchMenu} from '../data-access/catalog.models';

@Component({
 selector:'gc-catalog-menu-preview-page',
 imports:[GcCatalogNav,GcErrorState,RouterLink],
 template:`
 <main class="cat-page">
  <gc-catalog-nav/>
  <section class="cat-card">
   <div class="cat-row"><h2>Vista de menú vigente</h2>
    <a routerLink="/catalog/menus">Administrar menús</a>
   </div>
   <p class="cat-muted">Muestra exactamente las variantes comerciales que el servidor publica para la sucursal y fecha consultadas. No genera órdenes.</p>
   <div class="cat-toolbar">
    <label class="cat-field">Sucursal
     <select [value]="branchId()" (change)="branchId.set($any($event.target).value)">
      @for(branch of branches.branches();track branch.id){
       <option [value]="branch.id">{{branch.nombre}}</option>
      }
     </select>
    </label>
    <label class="cat-field">Fecha y hora a consultar
     <input type="datetime-local" [value]="localDate()" (change)="localDate.set($any($event.target).value)"/>
    </label>
    <button type="button" (click)="load()" [disabled]="busy()||!branchId()">Ver menú</button>
    <button type="button" (click)="now()" [disabled]="busy()">Ahora</button>
   </div>
   <p class="cat-muted">La hora de esta consulta se introduce en la zona horaria de tu equipo. El servidor interpreta la vigencia en la zona horaria configurada de la sucursal.</p>
   @if(busy()){<p role="status" class="cat-muted">Consultando la carta…</p>}
   @if(error()){<gc-error-state [message]="error()!" (retry)="load()"/>}
  </section>
  @if(result();as data){
   @if(!data.menus.length){<section class="cat-card"><p>No hay menús publicados y vigentes para esta fecha y sucursal.</p></section>}
   @for(menu of data.menus;track menu.id){
    <section class="cat-card">
     <h2>{{menu.nombre}}</h2>
     @if(menu.descripcion){<p class="cat-muted">{{menu.descripcion}}</p>}
     @for(section of menu.secciones;track section.id){
      <h3 class="cat-subheading">{{section.nombre}}</h3>
      <div class="cat-preview-grid">
       @for(item of section.items;track item.id){
        <article class="cat-preview-item">
         @if(item.variante.imagenPrincipalUrl){
          <img [src]="item.variante.imagenPrincipalUrl" alt="" loading="lazy"/>
         }
         <div class="cat-preview-info">
          <strong>{{item.variante.producto?.nombre??'Producto comercial'}}</strong>
          <span>{{item.variante.nombre}}</span>
          <strong>{{money(item.precio,item.moneda)}}</strong>
          @for(group of item.gruposModificadores;track group.grupoId){
           <div class="cat-preview-extras">
            <span>{{group.grupo}} · Mínimo {{group.minimo}}</span>
            @for(option of group.opciones;track option.id){
             <span>{{option.nombre}} (+{{money(option.recargo,item.moneda)}})</span>
            }
           </div>
          }
         </div>
        </article>
       }
      </div>
     }
    </section>
   }
   <p class="cat-muted">Precios y disponibilidad comercial. La vista no asegura stock físico ni ingredientes disponibles.</p>
  }
 </main>`,
 styleUrl:'../catalog.scss'
})
export class GcCatalogMenuPreviewPage implements OnInit {
 protected readonly access=inject(CatalogAccess);
 protected readonly branches=inject(GcBranchContext);
 private readonly api=inject(CatalogApi);
 protected readonly branchId=signal('');
 protected readonly localDate=signal('');
 protected readonly result=signal<CatalogBranchMenu|null>(null);
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly selectedBranch=computed(()=>this.branches.branches().find(x=>x.id===this.branchId()));
 ngOnInit(){this.branchId.set(this.branches.branchId()??this.branches.branches()[0]?.id??'');void this.load()}
 protected now(){this.localDate.set('');void this.load()}
 protected money(value:string,currency:string){
  try{return formatCurrency(value,currency==='USD'?'USD':'GTQ')}catch{return '—'}
 }
 private dateIso(){
  const value=this.localDate();
  if(!value)return undefined;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))throw new Error('Introduce una fecha y hora válida.');
  return date.toISOString();
 }
 protected async load(){
  const id=this.branchId();if(!id||!this.access.canRead()||this.busy())return;
  this.busy.set(true);this.error.set(null);
  try{this.result.set(await firstValueFrom(this.api.branchMenu(id,this.dateIso())))}
  catch(e){this.result.set(null);this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
}
