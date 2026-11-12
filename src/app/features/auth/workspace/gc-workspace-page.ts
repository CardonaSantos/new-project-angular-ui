import {Component,computed,effect,inject,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {gcErrorMessage} from '../../../core/http/api-error';
import {formatInstant} from '../../../shared/formatting';
import {OrdersAccess} from '../../orders/data-access/orders-access';
import {PaymentsAccess} from '../../payments/data-access/payments-access';
import {PurchasesAccess} from '../../purchases/data-access/purchases-access';
import {ReservationsAccess} from '../../reservations/data-access/reservations-access';
import {ReportsAccess} from '../../reports/data-access/reports-access';
import {ReportsApi} from '../../reports/data-access/reports.api';
import type {OperationalDashboard,ReportsOverview} from '../../reports/data-access/reports.models';
import {reportMoney} from '../../reports/data-access/reports.helpers';
import {GcReportsDailyChart} from '../../reports/components/reports-charts';
@Component({
 selector:'gc-workspace-page',
 imports:[RouterLink,GcReportsDailyChart],
 template:`
 <main class="rep-page rep-dashboard">
  <header class="rep-heading">
   <div><span class="rep-kicker">Gastro Core · Operación</span>
    <h1>Panel de control</h1>
    <p class="rep-muted">{{branch.active()?.nombre??'Selecciona una sucursal'}}</p>
   </div>
   <div class="rep-actions">
    @if(reports.canRead()){
     <a class="rep-button" routerLink="/reports">Ver analítica</a>
     <button type="button" [disabled]="busy()||!branch.branchId()" (click)="refresh()">Actualizar</button>
    }
   </div>
  </header>

  <section class="rep-section">
   <div class="rep-section-header">
    <div><h2>Accesos rápidos</h2>
     <p class="rep-muted">Continúa las tareas principales de tu sucursal.</p></div>
   </div>
   <div class="rep-shortcuts">
    @for(item of shortcuts();track item.path){
     <a [routerLink]="item.path" class="rep-shortcut">
      <span class="rep-shortcut-title">{{item.title}}</span>
      <span class="rep-muted">{{item.detail}}</span>
      <span class="rep-shortcut-arrow" aria-hidden="true">→</span>
     </a>
    }@empty{
     <p class="rep-muted">Los accesos aparecerán según los permisos de tu usuario.</p>
    }
   </div>
  </section>

  @if(!reports.canRead()){
   <section class="rep-card">
    <h2>Indicadores de operación</h2>
    <p class="rep-muted">La información estadística requiere el permiso «reports.read» en esta sucursal.</p>
   </section>
  }@else{
   @if(opError()){<p class="rep-alert" role="alert">{{opError()}} <button type="button" (click)="refresh()">Reintentar</button></p>}
   @if(busy()&&!operational()){<p class="rep-muted" role="status">Consultando operaciones…</p>}
   @if(operational();as live){
    <section class="rep-section">
     <div class="rep-section-header">
      <div><h2>Operación actual</h2>
       <p class="rep-muted">Datos del servidor · {{time(live.generatedAt,live.sucursal.zonaHoraria)}}</p>
      </div>
      <span class="rep-tag">Consulta en vivo</span>
     </div>
     <div class="rep-metrics rep-metrics-4">
      <a class="rep-metric rep-metric-link" routerLink="/orders/list">
       <span>Órdenes abiertas</span><strong>{{live.kpis.pedidosAbiertos}}</strong>
       <small>Pedidos por finalizar</small>
      </a>
      <a class="rep-metric rep-metric-link" routerLink="/orders/kitchen">
       <span>Comandas pendientes</span><strong>{{live.kpis.comandasPendientes}}</strong>
       <small>{{live.kpis.comandasPreparando}} en preparación</small>
      </a>
      <a class="rep-metric rep-metric-link" routerLink="/orders/tables">
       <span>Mesas ocupadas</span><strong>{{live.kpis.mesasOcupadas}}</strong>
       <small>Ocupaciones activas</small>
      </a>
      <a class="rep-metric rep-metric-link" routerLink="/payments/cash">
       <span>Turnos de caja abiertos</span><strong>{{live.kpis.turnosCajaAbiertos}}</strong>
       <small>En esta sucursal</small>
      </a>
     </div>
     <div class="rep-operational-secondary">
      <div><strong>{{live.kpis.entregasEnReparto}}</strong><span>Entregas en reparto</span></div>
      @if(reservations.canEnter()){
       <a class="rep-operational-secondary-link" routerLink="/reservations" [queryParams]="{estado:'CONFIRMADA'}">
        <strong>{{live.kpis.reservasConfirmadasProximas}}</strong><span>Reservas confirmadas próximas</span></a>
       <a class="rep-operational-secondary-link" routerLink="/reservations" [queryParams]="{estado:'PENDIENTE'}">
        <strong>{{live.kpis.reservasPendientesProximas}}</strong><span>Reservas pendientes próximas</span></a>
      }@else{
       <div><strong>{{live.kpis.reservasConfirmadasProximas}}</strong><span>Reservas confirmadas próximas</span></div>
       <div><strong>{{live.kpis.reservasPendientesProximas}}</strong><span>Reservas pendientes próximas</span></div>
      }
     </div>
     @if(reservations.canEnter()&&live.proximasReservas?.length){
      <div class="rep-upcoming-reservations">
       <h3>Próximas reservas</h3>
       <ul>
        @for(r of live.proximasReservas!;track r.id){
         <li>
          <a [routerLink]="['/reservations',r.id]">
           <strong>{{r.nombreContacto}}</strong>
           <span class="rep-muted">{{r.personas}} personas · {{time(r.inicio,live.sucursal.zonaHoraria)}}</span>
           <span class="rep-tag" [class.rep-tag-muted]="r.estado==='PENDIENTE'">
            {{r.estado==='CONFIRMADA'?'Confirmada':'Pendiente'}}</span>
          </a>
         </li>
        }
       </ul>
      </div>
     }
    </section>
   }

   <section class="rep-section">
    <div class="rep-section-header">
     <div><h2>Actividad del día operativo</h2>
      <p class="rep-muted">Ventas, cobros y gastos se registran en momentos distintos.</p>
     </div>
     <a class="rep-text-link" routerLink="/reports">Explorar períodos →</a>
    </div>
    @if(dayError()){<p class="rep-alert" role="alert">{{dayError()}}</p>}
    @if(today();as report){
     <div class="rep-metrics rep-metrics-4">
      <div class="rep-metric"><span>Ventas cerradas</span>
       <strong>{{money(report.kpis.ventasNetas,report.currency)}}</strong>
       <small>{{report.kpis.ticketsUnicos}} tickets</small></div>
      <div class="rep-metric"><span>Cobros netos</span>
       <strong>{{money(report.kpis.cobrosNetos,report.currency)}}</strong>
       <small>Después de reembolsos</small></div>
      <div class="rep-metric"><span>Gastos registrados</span>
       <strong>{{money(report.kpis.gastosRegistrados,report.currency)}}</strong>
       <small>No son una resta automática de ventas</small></div>
      <div class="rep-metric"><span>Ticket promedio</span>
       <strong>{{money(report.kpis.ticketPromedio,report.currency)}}</strong>
       <small>Basado en tickets únicos</small></div>
     </div>
     <div class="rep-card">
      <div class="rep-card-header"><h3>Datos del día</h3>
       <span class="rep-muted">{{report.periodo.desde}}</span></div>
      <p class="rep-muted">El resumen corresponde al día operativo de la sucursal
       (corte a las {{report.periodo.horaCorte}}, {{report.periodo.zonaHoraria}}).</p>
      <gc-reports-daily-chart [report]="report"/>
     </div>
    }@else if(!busy()&&!dayError()){
     <p class="rep-muted">Aún no hay resultados para presentar.</p>
    }
   </section>
  }
 </main>`
})
export class GcWorkspacePage {
 protected readonly branch=inject(GcBranchContext);
 protected readonly reports=inject(ReportsAccess);
 private readonly api=inject(ReportsApi);
 private readonly orders=inject(OrdersAccess);
 private readonly payments=inject(PaymentsAccess);
 private readonly purchases=inject(PurchasesAccess);
 protected readonly reservations=inject(ReservationsAccess);
 protected readonly operational=signal<OperationalDashboard|null>(null);
 protected readonly today=signal<ReportsOverview|null>(null);
 protected readonly opError=signal('');
 protected readonly dayError=signal('');
 protected readonly busy=signal(false);
 protected readonly money=reportMoney;
 private generation=0;
 protected readonly shortcuts=computed(()=>{
  const results:{path:string;title:string;detail:string}[]=[];
  if(this.orders.canCreate())results.push({path:'/orders/pos',title:'Punto de venta',detail:'Tomar un pedido'});
  if(this.orders.canKitchenRead())results.push({path:'/orders/kitchen',title:'Cocina',detail:'Atender comandas'});
  if(this.orders.canTablesRead())results.push({path:'/orders/tables',title:'Mesas',detail:'Consultar ocupaciones'});
  if(this.payments.canCashRead())results.push({path:'/payments/cash',title:'Caja',detail:'Turnos y efectivo'});
  if(this.payments.canSalesRead())results.push({path:'/payments/sales',title:'Ventas',detail:'Historial de ventas'});
  if(this.purchases.canQuickEntry())results.push({path:'/purchases/quick',title:'Entrada de stock',detail:'Ingresar insumos'});
  if(this.branch.has('inventory.read'))results.push({path:'/inventory',title:'Inventario',detail:'Revisar existencias'});
  if(this.reservations.canEnter())results.push({path:'/reservations',title:'Reservaciones',detail:'Ver y gestionar reservas'});
  return results;
 });
 constructor(){
  effect(()=>{
   const branchId=this.branch.branchId(),can=this.reports.canRead();
   untracked(()=>{
    this.generation++;this.operational.set(null);this.today.set(null);
    this.opError.set('');this.dayError.set('');
    if(branchId&&can)void this.refresh();
   });
  });
 }
 protected time(date:string,zone?:string){try{return formatInstant(date,zone??'America/Guatemala')}catch{return date}}
 protected async refresh(){
  const branchId=this.branch.branchId();
  if(!branchId||!this.reports.canRead())return;
  const gen=++this.generation;this.busy.set(true);
  this.opError.set('');this.dayError.set('');
  const [operational,day]=await Promise.allSettled([
   firstValueFrom(this.api.operational(branchId)),
   firstValueFrom(this.api.overview({sucursalId:branchId,periodo:'DIA'}))
  ]);
  if(gen!==this.generation||this.branch.branchId()!==branchId)return;
  if(operational.status==='fulfilled')this.operational.set(operational.value);
  else this.opError.set(gcErrorMessage(operational.reason));
  if(day.status==='fulfilled')this.today.set(day.value);
  else this.dayError.set(gcErrorMessage(day.reason));
  this.busy.set(false);
 }
}
