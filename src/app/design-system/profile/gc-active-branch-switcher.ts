import { Component, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GcBranchContext } from '../../core/organization/gc-branch-context';
import { gcErrorMessage } from '../../core/http/api-error';
import { GcNotificationService } from '../../core/ux/gc-notification.service';
import { GcSearchSelect } from '../forms/gc-search-select';

@Component({
 selector:'gc-active-branch-switcher',
 imports:[GcSearchSelect],
 template:`
  @if(branch.branches().length===1){
   <span class="gc-branch-name" [title]="branch.active()?.nombre??''">
    {{branch.active()?.nombre}}
   </span>
  } @else if(branch.branches().length>1){
   <div class="gc-branch-selector">
    <gc-search-select id="gc-header-active-branch" label="Sucursal activa"
     [items]="choices()" [value]="selected()" [disabled]="pending()||branch.loading()"
     [clearable]="false" placeholder="Seleccionar sucursal"
     (valueChange)="changeBranch($event)"/>
   </div>
  }
 `,
 styles:[`
  :host{display:inline-flex;min-width:0;max-width:100%;align-items:center}
  .gc-branch-selector{min-width:0;width:clamp(7rem,16vw,13.5rem);max-width:100%}
  .gc-branch-name{font-size:.875rem;color:var(--gc-on-surface-variant);
   overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:12rem}
  .gc-branch-selector gc-search-select{min-width:0}
  .gc-branch-selector gc-search-select .gc-select-field>label{
   position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap
  }
  @media(max-width:480px){.gc-branch-selector{width:8rem}.gc-branch-name{max-width:8rem}}
 `],
})
export class GcActiveBranchSwitcher {
 protected readonly branch=inject(GcBranchContext);
 private readonly notifications=inject(GcNotificationService);
 protected readonly pending=signal(false);
 protected readonly selected=signal('');
 protected readonly choices=(()=>this.branch.branches().map(b=>({id:b.id,label:b.nombre})));
 constructor(){effect(()=>this.selected.set(this.branch.branchId()??''))}
 protected async changeBranch(value:string):Promise<void>{
  const previous=this.branch.branchId()??'';
  if(value===previous||this.pending())return;
  this.selected.set(value);this.pending.set(true);
  try{await firstValueFrom(this.branch.select(value))}
  catch(error:unknown){
   this.selected.set(this.branch.branchId()??previous);
   this.notifications.show(gcErrorMessage(error),'error');
  }finally{this.pending.set(false)}
 }
}
