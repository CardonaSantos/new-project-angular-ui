import {Component,computed,effect,HostListener,inject,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {CdkTrapFocus} from '@angular/cdk/a11y';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {firstValueFrom,interval} from 'rxjs';
import {parseApiDecimal} from '../../../shared/formatting';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {ConfirmDialogService} from '../../../design-system/confirm-dialog/confirm-dialog.service';
import {GcSearchSelect} from '../../../design-system/forms/gc-search-select';
import {GcOrdersNav} from '../orders-nav';
import {GcKitchenTicket,GcKitchenModifiers} from '../components/orders-ui';
import {OrdersApi} from '../data-access/orders.api';
import {OrdersAccess} from '../data-access/orders-access';
import type {KitchenTicket,Station} from '../data-access/orders.models';
import {kitchenStage,modeText,operationKey,orderFriendlyError,qtyText} from '../data-access/orders.helpers';
@Component({
 selector:'gc-orders-kitchen-page',imports:[RouterLink,GcOrdersNav,GcSearchSelect,GcKitchenTicket,GcKitchenModifiers,CdkTrapFocus],
 template:`
 <main class="ord-page ord-kitchen"><gc-orders-nav/>
 <div class="ord-heading ord-kitchen-heading">
  <div><h1>Comandas de cocina</h1>
   <p class="ord-note">Preparar, dejar listo y registrar la entrega son pasos diferentes.</p></div>
  <div class="ord-actions">
   <button type="button" [class.active]="autoRefresh()"
    [attr.aria-pressed]="autoRefresh()" (click)="autoRefresh.update(v=>!v)">
    {{autoRefresh()?'Automático: activo':'Automático: pausado'}}
   </button>
   <button type="button" (click)="reload()" [disabled]="busy()">Actualizar</button>
  </div>
 </div>
 <section class="ord-card ord-kitchen-workspace">
  <div class="ord-kitchen-filters">
   <gc-search-select id="kitchen-branch" label="Sucursal" [items]="branches()"
    [value]="branchId()" [clearable]="false" (valueChange)="selectBranch($event)"/>
   <gc-search-select id="kitchen-station" label="Estación" [items]="stationOptions()"
    [value]="stationId()" placeholder="Todas las estaciones"
    (valueChange)="stationId.set($event);page.set(1);reload()"/>
   <gc-search-select id="kitchen-limit" label="Comandas por estado y página"
    [items]="pageSizes" [value]="limitText()" [searchable]="false" [clearable]="false"
    (valueChange)="changeLimit($event)"/>
  </div>
  <div class="ord-kitchen-tabs" role="group" aria-label="Mostrar comandas">
   <button type="button" [class.active]="view()==='active'"
    [attr.aria-pressed]="view()==='active'" (click)="setView('active')">Por preparar</button>
   <button type="button" [class.active]="view()==='ready'"
    [attr.aria-pressed]="view()==='ready'" (click)="setView('ready')">Para entregar</button>
   <button type="button" [class.active]="view()==='delivered'"
    [attr.aria-pressed]="view()==='delivered'" (click)="setView('delivered')">Entregadas</button>
   <button type="button" [class.active]="view()==='cancelled'"
    [attr.aria-pressed]="view()==='cancelled'" (click)="setView('cancelled')">Canceladas</button>
   <button type="button" [class.active]="view()==='all'"
    [attr.aria-pressed]="view()==='all'" (click)="setView('all')">Todas</button>
  </div>
  @if(error()){<p role="alert" class="ord-alert">{{error()}}</p>}
  @if(busy()){<p role="status" class="ord-muted">Consultando cocina…</p>}
  @if(!busy()&&!error()&&tickets().length){
   <div class="ord-kitchen-summary">
    <span><strong>{{pendingCount()}}</strong> pendientes</span>
    <span><strong>{{workingCount()}}</strong> preparando</span>
    <span><strong>{{readyCount()}}</strong> para entregar</span>
    <span><strong>{{deliveredCount()}}</strong> entregadas</span>
    <small>Totales de toda la sucursal y estación, no solo de la página.</small>
   </div>
  }
  <div class="ord-kitchen-board" aria-label="Comandas">
   @for(ticket of tickets();track ticket.id;let i=$index){

    <gc-kitchen-ticket [ticket]="ticket" (open)="inspect(ticket)">
     @if(access.canKitchenManage()&&ticket.estado!=='CANCELADA'){
      @if(ticket.estado==='PENDIENTE'){
       <button type="button" [disabled]="actionBusy()" (click)="start(ticket)">Comenzar preparación</button>
      }
      @if(ticket.estado==='PENDIENTE'||ticket.estado==='PREPARANDO'){
       <button type="button" [disabled]="actionBusy()" (click)="markTicketReady(ticket)">Marcar lista</button>
       <button type="button" class="ord-primary" [disabled]="actionBusy()" (click)="ready(ticket)">Lista y entregada</button>
      }
      @if(ticket.estado==='LISTA'&&stage(ticket).kind!=='delivered'){
       <button type="button" class="ord-primary" [disabled]="actionBusy()" (click)="ready(ticket)">Confirmar entrega</button>
      }
     }
    </gc-kitchen-ticket>
   } @empty {
    @if(!busy()&&!error()){<p class="ord-empty">{{view()==='active'?
     'No hay comandas pendientes de preparación.':'No hay comandas con estos filtros.'}}</p>}
   }
  </div>
  @if(total()>0){
   <div class="ord-pagination">
    <span>{{total()}} comandas · Página {{page()}} de {{pages()||1}}</span>
    <div class="ord-actions">
     <button type="button" [disabled]="page()<=1||busy()" (click)="changePage(-1)">Anterior</button>
     <button type="button" [disabled]="page()>=pages()||busy()" (click)="changePage(1)">Siguiente</button>
    </div>
   </div>
  }
 </section>
 @if(selected();as ticket){
  <button type="button" class="ord-overlay" (click)="closeDetails()"
   aria-label="Cerrar detalle de comanda"></button>
  <section class="ord-customizer ord-kitchen-dialog" role="dialog" aria-modal="true"
   aria-labelledby="kitchen-dialog-title" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
   <div class="ord-heading">
    <div><h2 id="kitchen-dialog-title">Comanda {{ticket.numero}}</h2>
     <span class="ord-ticket-badge" [class.ord-ticket-badge--ready]="stage(ticket).kind==='ready'"
      [class.ord-ticket-badge--delivered]="stage(ticket).kind==='delivered'">{{stage(ticket).label}}</span>
    </div>
    <div class="ord-actions">
     <a [routerLink]="['/orders/kitchen/tickets',ticket.id,'print']">Imprimir comanda</a>
     <button type="button" (click)="closeDetails()" [disabled]="actionBusy()">Cerrar</button>
    </div>
   </div>
   <div class="ord-ticket-detail-meta">
    <span><strong>Pedido:</strong> {{ticket.orden?.numero}}</span>
    <span><strong>Atención:</strong>
     {{ticket.orden?modeText(ticket.orden.modalidad):'Sin definir'}}
     @if(ticket.orden?.ocupacionMesa?.mesa?.numero){· Mesa {{ticket.orden?.ocupacionMesa?.mesa?.numero}}
    }</span>
    <span><strong>Estación:</strong> {{ticket.estacion?.nombre??'Sin estación'}}</span>
   </div>
   @if(ticket.orden?.observaciones){<p class="ord-note">Nota del pedido: {{ticket.orden?.observaciones}}</p>}
   @if(error()){<p class="ord-alert" role="alert">{{error()}}</p>}
   <div class="ord-kitchen-dialog-lines">
    @for(line of ticket.comandaLineasComoComanda;track line.id){
     <article class="ord-order-line">
      <div class="ord-line-title">
       <strong>{{qtyText(line.cantidad)}} × {{line.ordenLinea?.nombreSnapshot??
        line.ordenLinea?.variante?.producto?.nombre??'Producto'}}</strong>
       <span class="ord-ticket-badge">{{line.canceladaEn?'Cancelada':
        line.entregadaEn?'Entregada':line.listaEn?'Lista para entregar':'En preparación'}}</span>
      </div>
      <gc-kitchen-modifiers [modifiers]="line.ordenLinea?.ordenLineaModificadoresComoOrdenLinea"/>
      @if(line.ordenLinea?.notasCocina){<p class="ord-note">Nota para cocina: {{line.ordenLinea?.notasCocina}}</p>}
      @if(access.canKitchenManage()&&!line.canceladaEn){
       <div class="ord-actions">
        @if(!line.listaEn){
         <label class="ord-partial">Cantidad a preparar
          <input type="text" inputmode="decimal"
           [value]="partial()[line.id]??remaining(line.cantidad,line.cantidadPreparada)"
           (input)="setPartial(line.id,$any($event.target).value)"/>
         </label>
         <button type="button" [disabled]="actionBusy()"
          (click)="startLine(line.id,line.cantidad,line.cantidadPreparada)">Preparar cantidad</button>
         <button type="button" [disabled]="actionBusy()"
          (click)="markLineReady(line.id)">Marcar lista</button>
         <button type="button" class="ord-primary" [disabled]="actionBusy()"
          (click)="markReady(line.id)">Lista y entregada</button>
        } @else if(!line.entregadaEn){
         <button type="button" class="ord-primary" [disabled]="actionBusy()"
          (click)="deliver(line.id)">Confirmar entrega</button>
        }
       </div>
      }
     </article>
    }
   </div>
   <p class="ord-note">Lista = preparada para servir. La entrega se registra por separado.</p>
  </section>
 }
 </main>`
})
export class GcOrdersKitchenPage{
 private readonly api=inject(OrdersApi);
 private readonly confirm=inject(ConfirmDialogService);
 private readonly notices=inject(GcNotificationService);
 private readonly branch=inject(GcBranchContext);
 protected readonly access=inject(OrdersAccess);
 protected readonly branches=computed(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 protected readonly stationOptions=computed(()=>this.stations().filter(x=>x.activa).map(s=>({id:s.id,label:s.nombre})));
 protected readonly branchId=signal('');protected readonly stationId=signal('');
 protected readonly view=signal<'active'|'ready'|'delivered'|'cancelled'|'all'>('active');
 protected readonly stations=signal<Station[]>([]);
 protected readonly tickets=signal<KitchenTicket[]>([]);protected readonly selected=signal<KitchenTicket|null>(null);
 protected readonly busy=signal(false);protected readonly actionBusy=signal(false);
 protected readonly error=signal<string|null>(null);
 protected readonly page=signal(1);protected readonly total=signal(0);protected readonly pages=signal(0);
 protected readonly limit=signal(30);protected readonly limitText=computed(()=>String(this.limit()));
 protected readonly pageSizes=[{id:'15',label:'15'},{id:'30',label:'30'},{id:'50',label:'50'}];
 protected readonly autoRefresh=signal(true);
 protected readonly totals=signal({pending:0,preparing:0,readyToDeliver:0,delivered:0});
 protected readonly pendingCount=computed(()=>this.totals().pending);
 protected readonly workingCount=computed(()=>this.totals().preparing);
 protected readonly readyCount=computed(()=>this.totals().readyToDeliver);
 protected readonly deliveredCount=computed(()=>this.totals().delivered);
 protected readonly partial=signal<Record<string,string>>({});
 protected readonly qtyText=qtyText;
 protected readonly modeText=modeText;
 protected readonly stage=kitchenStage;
 private cursor='';private querying=false;private generation=0;private inspectGeneration=0;
 private startKeys=new Map<string,{quantity:string;key:string}>();
 private handoffKeys=new Map<string,string>();
 constructor(){
  effect(()=>{
   const b=this.branch.branchId();
   untracked(()=>{
    if(b&&b!==this.branchId()){
     this.branchId.set(b);this.cursor='';this.stationId.set('');this.page.set(1);
     this.tickets.set([]);this.selected.set(null);this.inspectGeneration++;void this.reload();
    }
   });
  });
  interval(7000).pipe(takeUntilDestroyed()).subscribe(()=>{
   if(this.autoRefresh()&&typeof document!=='undefined'&&!document.hidden&&
    this.branchId()&&!this.busy())void this.poll();
  });
 }
 protected setView(v:'active'|'ready'|'delivered'|'cancelled'|'all'){
  if(v===this.view())return;
  this.view.set(v);this.page.set(1);void this.reload();
 }
 protected changeLimit(v:string){
  const n=Number(v);if(![15,30,50].includes(n)||n===this.limit())return;
  this.limit.set(n);this.page.set(1);void this.reload();
 }
 protected closeDetails(){
  if(!this.actionBusy()){this.inspectGeneration++;this.selected.set(null)}
 }
 @HostListener('document:keydown.escape')
 protected dismissByEscape(){this.closeDetails()}
 protected selectBranch(id:string){
  if(!id||id===this.branchId())return;
  this.branchId.set(id);this.cursor='';this.stationId.set('');this.page.set(1);
  this.tickets.set([]);this.selected.set(null);this.inspectGeneration++;void this.reload();
 }
 protected changePage(d:number){
  const next=this.page()+d;if(next<1||next>this.pages()||this.busy())return;
  this.page.set(next);void this.reload();
 }
 protected async reload(){
  const branch=this.branchId();if(!branch||!this.access.canKitchenRead())return;
  const gen=++this.generation;this.busy.set(true);this.error.set(null);
  try{
   const base={sucursalId:branch,estacionId:this.stationId()||undefined,
    page:this.page(),limit:this.limit()};
   const requested=this.view();
   const [stations,report]=await Promise.all([
    firstValueFrom(this.api.stations(branch)),
    requested==='cancelled'
     ?firstValueFrom(this.api.tickets({...base,estado:'CANCELADA'}))
     :firstValueFrom(this.api.queue({...base,vista:requested==='ready'?'PARA_ENTREGAR':
       requested==='delivered'?'ENTREGADAS':requested==='all'?'TODAS':'ACTIVAS'}))
   ]);
   if(gen!==this.generation||branch!==this.branchId())return;
   this.stations.set(stations);this.tickets.set(report.data);
   this.total.set(report.meta.total);this.pages.set(report.meta.totalPages);
   if('totals' in report)this.totals.set(report.totals);
   if(!report.data.length&&this.page()>1){this.page.set(1);void this.reload()}
  }catch(e){if(gen===this.generation)this.error.set(orderFriendlyError(e))}
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
 private async mutate(call:()=>Promise<KitchenTicket>,success=''){
  if(this.actionBusy())return;
  this.actionBusy.set(true);this.error.set(null);
  try{
   const updated=await call();
   if(this.selected()?.id===updated.id)this.selected.set(updated);
   if(success)this.notices.show(success,'success',5000);
   await this.reload();
  }catch(e){this.error.set(orderFriendlyError(e))}
  finally{this.actionBusy.set(false)}
 }
 protected async inspect(t:KitchenTicket){
  const generation=++this.inspectGeneration,branch=this.branchId();
  this.error.set(null);this.selected.set(t);
  try{
   const ticket=await firstValueFrom(this.api.ticket(t.id));
   if(generation===this.inspectGeneration&&branch===this.branchId())this.selected.set(ticket);
  }catch(e){
   if(generation===this.inspectGeneration)this.error.set(orderFriendlyError(e));
  }
 }
 protected async start(t:KitchenTicket){
  if(!await this.confirm.confirm({title:'Iniciar preparación',
   message:'Este paso puede descontar ingredientes del inventario.',
   confirmText:'Iniciar'}))return;
  await this.mutate(()=>firstValueFrom(this.api.startTicket(t.id)));
 }
 private async readyAndDeliver(ticketId:string,lineId?:string){
  if(this.actionBusy())return;
  if(!await this.confirm.confirm({
   title:'Confirmar preparación y entrega',
   message:'Marca entregado solo cuando el producto se haya entregado realmente. El servidor procesará preparación y entrega en una sola operación.',
   confirmText:'Sí, está entregado'
  }))return;
  const identity=lineId?'line:'+lineId:'ticket:'+ticketId;
  let key=this.handoffKeys.get(identity);
  if(!key){key=operationKey('kds-handoff');this.handoffKeys.set(identity,key)}
  this.actionBusy.set(true);this.error.set(null);
  try{
   const updated=await firstValueFrom(lineId
    ?this.api.readyDeliverLine(lineId,key)
    :this.api.readyDeliverTicket(ticketId,key));
   this.handoffKeys.delete(identity);
   if(this.selected()?.id===updated.id)this.selected.set(updated);
   this.notices.show(lineId?'Producto listo y entregado.':'Comanda lista y entregada.','success',6000);
   await this.reload();
  }catch(e){
   const message=orderFriendlyError(e);this.error.set(message);
   this.notices.show(message,'error',0);
  }finally{this.actionBusy.set(false)}
 }
 protected async ready(t:KitchenTicket){await this.readyAndDeliver(t.id)}
 protected async markTicketReady(t:KitchenTicket){
  if(this.actionBusy())return;
  await this.mutate(()=>firstValueFrom(this.api.readyTicket(t.id)),'Comanda lista para entregar.');
 }
 protected remaining(total:string,done:string){
  try{return parseApiDecimal(total).minus(parseApiDecimal(done)).toFixed(3).replace(/\.?0+$/,'')}
  catch{return total}
 }
 protected setPartial(id:string,q:string){
  this.partial.update(p=>({...p,[id]:q}));this.startKeys.delete(id);
 }
 protected async startLine(id:string,total:string,prepared:string){
  const q=this.partial()[id]??this.remaining(total,prepared);
  try{
   const count=parseApiDecimal(q);
   if(count.lte(0)||count.decimalPlaces()>3||count.gt(
    parseApiDecimal(total).minus(parseApiDecimal(prepared)))){
    this.error.set('La cantidad supera la pendiente de preparar.');return;
   }
  }catch{this.error.set('Introduce una cantidad válida.');return}
  const existing=this.startKeys.get(id);
  const key=existing?.quantity===q?existing.key:operationKey('kitchen-line');
  this.startKeys.set(id,{quantity:q,key});
  await this.mutate(()=>firstValueFrom(this.api.startLine(id,key,q)));
  if(!this.error()){this.startKeys.delete(id);this.partial.update(x=>({...x,[id]:''}))}
 }
 protected async markReady(id:string){
  const selected=this.selected();
  if(selected)await this.readyAndDeliver(selected.id,id);
 }
 protected async markLineReady(id:string){
  if(this.actionBusy())return;
  await this.mutate(()=>firstValueFrom(this.api.readyLine(id)),'Producto listo para entregar.');
 }
 protected async deliver(id:string){
  const selected=this.selected();
  if(selected)await this.readyAndDeliver(selected.id,id);
 }
}
