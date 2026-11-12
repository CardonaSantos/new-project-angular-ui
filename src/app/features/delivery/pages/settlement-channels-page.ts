
import {Component,OnInit,inject,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {GcPageHeader} from '../../../design-system/components/page-header/gc-page-header';
import {GcButtonDirective} from '../../../design-system/components/button/gc-button.directive';
import {GcErrorState} from '../../../design-system/feedback/gc-error-state';
import {GcNotificationService} from '../../../core/ux/gc-notification.service';
import {gcErrorMessage} from '../../../core/http/api-error';
import {operationKey} from '../../orders/data-access/orders.helpers';
import {DeliverySettlementsApi} from '../data-access/delivery-settlements.api';
import type {PlatformChannel} from '../data-access/delivery-settlements.models';

const CODE_PATTERN=/^[A-Z0-9_-]{2,40}$/;

@Component({
 selector:'gc-settlement-channels-page',
 imports:[RouterLink,GcPageHeader,GcButtonDirective,GcErrorState],
 template:`
 <main class="del-page del-narrow">
  <gc-page-header title="Canales de plataforma externa"
   description="Catálogo de plataformas (Uber Eats, PedidosYa, etc.) usado al liquidar sus entregas.">
   <a gcPageActions gcButton variant="outline" routerLink="/delivery/settlements">Volver a liquidaciones</a>
  </gc-page-header>

  @if(loadError()){<gc-error-state [message]="loadError()!" (retry)="load()"/>}
  @else{
   <section class="del-card">
    <h2>Activos</h2>
    @if(!busy()&&!channels().length){<p class="del-muted">Todavía no hay canales registrados.</p>}
    @if(channels().length){
     <div class="del-blockers">
      @for(c of channels();track c.id){
       <div class="del-row" style="justify-content:space-between;border:1px solid var(--gc-outline-variant);border-radius:.5rem;padding:.5rem .65rem;">
        <span>{{c.nombre}}</span><span class="del-muted">{{c.codigo}}</span>
       </div>
      }
     </div>
    }
   </section>

   <section class="del-card">
    <h2>Registrar canal</h2>
    <div class="del-field">
     <label for="chn-codigo">Código</label>
     <input id="chn-codigo" [value]="codigo()" maxlength="40"
      (input)="codigo.set($any($event.target).value.toUpperCase())" placeholder="UBER_EATS"/>
     <small>Solo letras, números, guiones y guión bajo.</small>
    </div>
    <div class="del-field">
     <label for="chn-nombre">Nombre</label>
     <input id="chn-nombre" [value]="nombre()" maxlength="100"
      (input)="nombre.set($any($event.target).value)" placeholder="Uber Eats"/>
    </div>
    @if(actionError()){<p class="del-alert" role="alert">{{actionError()}}</p>}
    <div class="del-actions">
     <button type="button" gcButton [disabled]="!canSubmit()||actionBusy()" (click)="register()">
      {{actionBusy()?'Registrando…':'Registrar canal'}}</button>
    </div>
   </section>
  }
 </main>`,
 styleUrl:'../delivery.scss'
})
export class GcSettlementChannelsPage implements OnInit{
 private readonly branch=inject(GcBranchContext);
 private readonly api=inject(DeliverySettlementsApi);
 private readonly notice=inject(GcNotificationService);
 protected readonly channels=signal<PlatformChannel[]>([]);
 protected readonly busy=signal(false);
 protected readonly loadError=signal<string|null>(null);
 protected readonly codigo=signal('');
 protected readonly nombre=signal('');
 protected readonly actionBusy=signal(false);protected readonly actionError=signal('');
 ngOnInit(){void this.load()}
 protected canSubmit(){
  return CODE_PATTERN.test(this.codigo().trim())&&this.nombre().trim().length>=2;
 }
 protected async load(){
  const branchId=this.branch.branchId();if(!branchId)return;
  this.busy.set(true);this.loadError.set(null);
  try{
   const result=await firstValueFrom(this.api.channels(branchId));
   this.channels.set(result.data);
  }catch(e){this.loadError.set(gcErrorMessage(e))}
  finally{this.busy.set(false)}
 }
 protected async register(){
  const branchId=this.branch.branchId();
  if(!branchId||!this.canSubmit()||this.actionBusy())return;
  this.actionBusy.set(true);this.actionError.set('');
  try{
   await firstValueFrom(this.api.registerChannel({
    sucursalId:branchId,codigo:this.codigo().trim(),nombre:this.nombre().trim(),
    claveOperacion:operationKey('platform-channel')
   }));
   this.notice.show('Canal registrado.','success');
   this.codigo.set('');this.nombre.set('');
   await this.load();
  }catch(e){this.actionError.set(gcErrorMessage(e))}
  finally{this.actionBusy.set(false)}
 }
}
