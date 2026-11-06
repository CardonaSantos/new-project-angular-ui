import {Component,inject,OnInit,signal} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcPageState} from '../../../core/ux/gc-page-state';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {formatInstant,formatDecimal,formatCurrency} from '../../../shared/formatting';
import type {ProductionDetail} from '../data-access/recipes.models';
import {RecipesApi} from '../data-access/recipes.api';
import {RecipesAccess} from '../data-access/recipes-access';
import {GcRecipesNav} from '../recipes-nav';

@Component({
 selector:'gc-recipes-production-detail-page',imports:[RouterLink,GcRecipesNav],
 template:`<main class="rec-page">
  <gc-recipes-nav/>
  <a routerLink="/recipes/production" class="rec-link">Volver a producciones</a>
  @if(state.busy()){<p class="rec-muted" role="status">Cargando preparación…</p>}
  @if(state.status()==='error'){<section class="rec-card">
   <p class="rec-alert" role="alert">{{message()}}</p>
   <button type="button" (click)="reload()">Reintentar</button></section>}
  @if(state.data();as doc){
   <section class="rec-card">
    <div class="rec-top"><h2>{{doc.articuloResultado?.nombre??doc.recetaVersion.receta.nombre}}</h2>
     <strong>{{status(doc.estado)}}</strong></div>
    <div class="rec-metrics">
     <div class="rec-metric"><span>Cantidad elaborada</span>
      <strong>{{number(doc.cantidadProducida)}} {{doc.articuloResultado?.unidadBase?.codigo??''}}</strong></div>
     <div class="rec-metric"><span>Receta utilizada</span>
      <a class="rec-link" [routerLink]="['/recipes/list',doc.recetaVersion.receta.id]">
       {{doc.recetaVersion.receta.nombre}}</a></div>
     <div class="rec-metric"><span>Ubicación de destino</span>
      <strong>{{doc.ubicacionDestino.nombre}}</strong></div>
     <div class="rec-metric"><span>Fecha</span><strong>{{date(doc.creadoEn)}}</strong></div>
     @if(doc.costoTotal!==undefined&&doc.costoTotal!==null&&access.canSeeCosts()){
      <div class="rec-metric"><span>Costo contabilizado</span>
       <strong>{{currency(doc.costoTotal)}}</strong></div>}
    </div>
    <div class="rec-form">
     <div class="rec-field"><span>Fórmula</span><strong>Versión {{doc.recetaVersion.numero}}</strong></div>
     <div class="rec-field"><span>Lote obtenido</span><strong>{{doc.loteResultado?.codigoLote??'Sin lote'}}</strong></div>
     @if(doc.fechaVencimiento){<div class="rec-field"><span>Vencimiento</span><strong>{{doc.fechaVencimiento}}</strong></div>}
     @if(doc.confirmadoEn){<div class="rec-field"><span>Confirmada el</span><strong>{{date(doc.confirmadoEn)}}</strong></div>}
    </div>
    @if(doc.estado==='BORRADOR'){
     <p class="rec-note">Todavía no se han descontado los ingredientes ni ingresado el producto elaborado al inventario.</p>
     @if(access.canProduce()){<div class="rec-actions">
      <button type="button" class="rec-primary" [disabled]="busy()" (click)="confirm(doc)">Confirmar producción</button>
      <button type="button" [disabled]="busy()" (click)="cancel(doc)">Cancelar borrador</button>
     </div>}
    }
    @if(doc.estado==='CONFIRMADA'){
     <p class="rec-note">La producción quedó registrada. Los ingredientes consumidos y la entrada del resultado ya forman parte de Inventario.</p>
    }
    @if(doc.estado==='CANCELADA'){<p class="rec-note">Esta producción fue cancelada y no generó movimientos de inventario.</p>}
    @if(error()){<p class="rec-alert" role="alert">{{error()}}</p>}
   </section>
   <section class="rec-card">
    <h2>Ingredientes utilizados</h2>
    @if(doc.estado==='BORRADOR'){<p class="rec-note">Los consumos se mostrarán cuando confirmes la producción.</p>}
    <div class="rec-table-wrap"><table class="rec-table">
     <thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Ubicación</th><th>Lote</th>
      @if(doc.costoTotal!==undefined&&access.canSeeCosts()){<th>Costo</th>}</tr></thead>
     <tbody>
      @for(item of doc.consumos;track item.id){
       <tr><td>{{item.articulo.nombre}}</td>
        <td>{{number(item.cantidad)}}</td>
        <td>{{item.ubicacion.nombre}}</td>
        <td>{{item.lote?.codigoLote??'Sin lote'}}</td>
        @if(doc.costoTotal!==undefined&&access.canSeeCosts()){
         <td>{{item.costoTotal!==null&&item.costoTotal!==undefined?currency(item.costoTotal):'—'}}</td>}
       </tr>
      } @empty {<tr><td colspan="5">No hay consumos registrados.</td></tr>}
     </tbody></table></div>
   </section>
  }
 </main>`,styleUrl:'../recipes.scss'
})
export class GcRecipesProductionDetailPage implements OnInit {
 protected readonly access=inject(RecipesAccess);
 private readonly branchContext=inject(GcBranchContext);
 private readonly api=inject(RecipesApi);
 private readonly dialog=inject(ConfirmDialogService);
 private readonly notifications=inject(GcNotificationService);
 private readonly id=inject(ActivatedRoute).snapshot.paramMap.get('id')??'';
 protected readonly state=new GcPageState<ProductionDetail>();
 protected readonly busy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly number=formatDecimal;
 protected readonly date=(value:string)=>formatInstant(value,
  this.branchContext.branches().find(x=>x.id===this.state.data()?.ubicacionDestino.almacen?.sucursalId)?.zonaHoraria??'America/Guatemala');
 protected readonly currency=formatCurrency;
 protected readonly message=()=>gcErrorMessage(this.state.error());
 protected readonly status=(v:string)=>v==='CONFIRMADA'?'Confirmada':v==='CANCELADA'?'Cancelada':'Pendiente';
 ngOnInit(){this.reload()}
 protected reload(){void this.state.load(()=>firstValueFrom(this.api.productionDetail(this.id)))}
 protected async confirm(doc:ProductionDetail){
  if(!this.access.canProduce()||this.busy()||doc.estado!=='BORRADOR')return;
  const ok=await this.dialog.confirm({title:'Confirmar producción',
   message:'Se descontarán los ingredientes del inventario y se registrará el resultado elaborado.',
   confirmText:'Confirmar producción'});
  if(!ok)return;
  this.busy.set(true);this.error.set(null);
  try{await firstValueFrom(this.api.productionConfirm(this.id));
   await this.state.load(()=>firstValueFrom(this.api.productionDetail(this.id)));
   this.notifications.show('Producción confirmada.','success');
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async cancel(doc:ProductionDetail){
  if(!this.access.canProduce()||this.busy()||doc.estado!=='BORRADOR')return;
  const ok=await this.dialog.confirm({title:'Cancelar producción',
   message:'La producción pendiente quedará cancelada. No habrá movimientos de inventario.',
   confirmText:'Cancelar',danger:true});
  if(!ok)return;
  this.busy.set(true);this.error.set(null);
  try{await firstValueFrom(this.api.productionCancel(this.id));
   await this.state.load(()=>firstValueFrom(this.api.productionDetail(this.id)));
   this.notifications.show('Producción cancelada.','success');
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
}
