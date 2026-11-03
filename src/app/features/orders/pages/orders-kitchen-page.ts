import {Component,computed,effect,inject,signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {firstValueFrom,interval} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcOrdersNav} from '../orders-nav';
import {GcKitchenTicket} from '../components/orders-ui';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import {TICKET_STATES,type KitchenTicket,type Station,type TicketState} from '../data-access/orders.models';
import {operationKey,qtyText} from '../data-access/orders.helpers';
@Component({
 selector:'gc-orders-kitchen-page',imports:[GcOrdersNav,GcSearchSelect,GcKitchenTicket],
 template:`
 <main class="ord-page ord-kitchen">
 <gc-orders-nav/>
 <div class="ord-heading"><div><h1>Cocina</h1><p>Comandas pendientes y en preparación.</p></div>
  <div class="ord-actions"><span class="ord-note">Actualización automática</span>
   <button type="button" (click)="reload()" [disabled]="busy()">Actualizar</button></div>
 </div>
 <section class="ord-card">
  <div class="ord-filter-grid">
   <gc-search-select id="kitchen-branch" label="Sucursal" [items]="branches()"
    [value]="branchId()" [clearable]="false" (valueChange)="selectBranch($event)"/>
   <gc-search-select id="kitchen-station" label="Estación" [items]="stationOptions()"
    [value]="stationId()" placeholder="Todas las estaciones" (valueChange)="stationId.set($event);reload()"/>
   <gc-search-select id="kitchen-status" label="Estado" [items]="states"
    [value]="state()" [searchable]="false" placeholder="Todos"
    (valueChange)="state.set($event);reload()"/>
  </div>
  @if(error()){<p class="ord-alert" role="alert">{{error()}}</p>}
  @if(busy()){<p role="status" class="ord-muted">Consultando cocina…</p>}
  <div class="ord-kitchen-board">
   @for(ticket of tickets();track ticket.id){
    <gc-kitchen-ticket [ticket]="ticket">
     @if(access.canKitchenManage()&&ticket.estado!=='CANCELADA'){
      <div class="ord-actions ord-ticket-actions">
       @if(ticket.estado==='PENDIENTE'){
        <button type="button" [disabled]="actionBusy()" (click)="start(ticket)">Iniciar preparación</button>}
       @if(ticket.estado!=='LISTA'){
        <button type="button" class="ord-primary" [disabled]="actionBusy()" (click)="ready(ticket)">Marcar comanda lista</button>}
       <button type="button" [disabled]="actionBusy()" (click)="inspect(ticket)">Ver líneas</button>
      </div>
     } @else {<button type="button" (click)="inspect(ticket)">Ver detalle</button>}
    </gc-kitchen-ticket>
   } @empty {<p class="ord-empty">No hay comandas con los filtros seleccionados.</p>}
  </div>
  <div class="ord-pagination">
   <span>{{total()}} comandas · Página {{page()}} de {{pages()||1}}</span>
   <div class="ord-actions"><button type="button" [disabled]="page()<=1||busy()" (click)="changePage(-1)">Anterior</button>
    <button type="button" [disabled]="page()>=pages()||busy()" (click)="changePage(1)">Siguiente</button></div>
  </div>
 </section>
 @if(selected();as ticket){
  <section class="ord-card ord-ticket-detail">
   <div class="ord-heading"><h2>Comanda {{ticket.numero}}</h2><button type="button" (click)="selected.set(null)">Cerrar detalle</button></div>
   <p>{{ticket.estacion?.nombre??'Cocina'}} · Orden {{ticket.orden?.numero??''}}</p>
   @for(line of ticket.comandaLineasComoComanda;track line.id){
    <div class="ord-order-line">
     <strong>{{qtyText(line.cantidad)}} × {{line.ordenLinea?.nombreSnapshot??line.ordenLinea?.variante?.producto?.nombre}}</strong>
     @if(line.ordenLinea?.notasCocina){<p>Indicaciones: {{line.ordenLinea?.notasCocina}}</p>}
     <small>{{line.listaEn?'Lista':line.canceladaEn?'Cancelada':'Por preparar: '+remaining(line.cantidad,line.cantidadPreparada)}}</small>
     @if(access.canKitchenManage()&&!line.canceladaEn){
      <div class="ord-actions">
       @if(!line.listaEn){
        <label class="ord-partial">Cantidad a preparar
         <input type="text" inputmode="decimal" [value]="partial()[line.id]??remaining(line.cantidad,line.cantidadPreparada)"
          (input)="setPartial(line.id,$any($event.target).value)"/>
        </label>
        <button type="button" [disabled]="actionBusy()"
         (click)="startLine(line.id,line.cantidad,line.cantidadPreparada)">Iniciar cantidad</button>
        <button type="button" class="ord-primary" [disabled]="actionBusy()" (click)="markReady(line.id)">Lista</button>
       }
       @if(line.listaEn&&!line.entregadaEn){
        <button type="button" class="ord-primary" [disabled]="actionBusy()"
         (click)="deliver(line.id)">Entregar producto</button>
       }
      </div>
     }
    </div>
   }
  </section>
 }
 </main>`
})
export class GcOrdersKitchenPage{
 private readonly api=inject(OrdersApi);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly branch=inject(GcBranchContext);
 protected readonly access=inject(OrdersAccess);
 protected readonly states=TICKET_STATES;
 protected readonly branches=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly stationOptions=computed(()=>this.stations().filter(x=>x.activa).map(s=>({id:s.id,label:s.nombre})));
 protected readonly branchId=signal('');protected readonly stationId=signal('');
 protected readonly state=signal<TicketState|''>('');protected readonly stations=signal<Station[]>([]);
 protected readonly tickets=signal<KitchenTicket[]>([]);protected readonly selected=signal<KitchenTicket|null>(null);
 protected readonly busy=signal(false);protected readonly actionBusy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly page=signal(1);protected readonly total=signal(0);protected readonly pages=signal(0);
 protected readonly partial=signal<Record<string,string>>({});
 protected readonly qtyText=qtyText;
 private cursor='';private querying=false;private generation=0;private startKeys=new Map<string,{quantity:string;key:string}>();
 constructor(){
  effect(()=>{
   const b=this.branch.branchId();
   if(b&&b!==this.branchId()){this.branchId.set(b);this.cursor='';this.stationId.set('');this.page.set(1);void this.reload()}
  });
  interval(7000).pipe(takeUntilDestroyed()).subscribe(()=>{
   if(typeof document!=='undefined'&&!document.hidden&&this.branchId()&&!this.busy())void this.poll();
  });
 }
 protected selectBranch(id:string){this.branchId.set(id);this.cursor='';this.stationId.set('');void this.reload()}
 protected changePage(d:number){this.page.update(x=>x+d);void this.reload()}
 protected async reload(){
  const branch=this.branchId();if(!branch||!this.access.canKitchenRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set(null);
  try{
   const [stations,page]=await Promise.all([
    firstValueFrom(this.api.stations(branch)),
    firstValueFrom(this.api.tickets({sucursalId:branch,estacionId:this.stationId()||undefined,
     estado:this.state()||undefined,page:this.page(),limit:30}))
   ]);
   if(gen!==this.generation)return;
   this.stations.set(stations);this.tickets.set(page.data);
   this.total.set(page.meta.total);this.pages.set(page.meta.totalPages);
  }catch(e){if(gen===this.generation)this.error.set(gcErrorMessage(e))}
  finally{if(gen===this.generation)this.busy.set(false)}
 }
 private async poll(){
  const branch=this.branchId();if(!branch||this.querying)return;
  this.querying=true;
  try{
   const data=await firstValueFrom(this.api.changes(branch,this.cursor||undefined));
   if(branch!==this.branchId())return;
   const latest=data.data.at(-1);
   if(latest)this.cursor=latest.id;
   if(data.data.length)await this.reload();
  }catch{
   // A stale/deleted cursor must be rebuilt from a full ticket list.
   this.cursor='';await this.reload();
  }finally{this.querying=false}
 }
 private async mutate(call:()=>Promise<KitchenTicket>){
  if(this.actionBusy())return;
  this.actionBusy.set(true);this.error.set(null);
  try{
   const updated=await call();
   this.selected.set(updated);await this.reload();
  }catch(e){this.error.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async inspect(t:KitchenTicket){
  this.error.set(null);
  try{this.selected.set(await firstValueFrom(this.api.ticket(t.id)))}
  catch(e){this.error.set(gcErrorMessage(e))}
 }
 protected async start(t:KitchenTicket){
  if(!await this.confirm.confirm({title:'Iniciar preparación',
   message:'Este paso puede descontar ingredientes del inventario.',
   confirmText:'Iniciar'}))return;
  await this.mutate(()=>firstValueFrom(this.api.startTicket(t.id)));
 }
 protected async ready(t:KitchenTicket){
  if(!await this.confirm.confirm({title:'Marcar comanda lista',
   message:'Los productos pendientes pueden consumir inventario al prepararse.',
   confirmText:'Marcar lista'}))return;
  await this.mutate(()=>firstValueFrom(this.api.readyTicket(t.id)));
 }
 protected remaining(total:string,done:string){
  try{return (Number(total)-Number(done)).toFixed(3).replace(/\.?0+$/,'')}
  catch{return total}
 }
 protected setPartial(id:string,q:string){
  this.partial.update(p=>({...p,[id]:q}));this.startKeys.delete(id);
 }
 protected async startLine(id:string,total:string,prepared:string){
  const q=this.partial()[id]??this.remaining(total,prepared);
  const count=Number(q);if(!Number.isFinite(count)||count<=0||count>Number(total)-Number(prepared)){
   this.error.set('La cantidad supera la pendiente de preparar.');return;
  }
  const existing=this.startKeys.get(id);
  const key=existing?.quantity===q?existing.key:operationKey('kitchen-line');
  this.startKeys.set(id,{quantity:q,key});
  await this.mutate(()=>firstValueFrom(this.api.startLine(id,key,q)));
  if(!this.error()){this.startKeys.delete(id);this.partial.update(x=>({...x,[id]:''}))}
 }
 protected async markReady(id:string){
  await this.mutate(()=>firstValueFrom(this.api.readyLine(id)));
 }
 protected async deliver(id:string){
  await this.mutate(()=>firstValueFrom(this.api.deliverLine(id)));
 }
}
