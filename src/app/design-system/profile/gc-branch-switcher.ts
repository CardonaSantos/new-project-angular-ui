import { Component, computed, inject } from '@angular/core';
import { GcAuthFacade } from '../../core/auth/demo-auth.facade';
import { GcSearchSelect } from '../forms/gc-search-select';

@Component({
 selector:'gc-branch-switcher',
 imports:[GcSearchSelect],
 template:`
  @if(auth.authenticated()){
   <gc-search-select id="gc-demo-branch" label="Sucursal" [items]="choices()"
    [value]="auth.branchId()??''" [clearable]="false"
    (valueChange)="auth.switchBranch($event)"/>
  }
 `,
 styles:[`
  :host{display:block;min-width:0;width:min(12.5rem,100%)}
  gc-search-select{display:block;min-width:0;width:100%}
  @media(max-width:650px){
   :host{width:8.5rem}
   gc-search-select .gc-select-field>label{
    position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap
   }
  }
 `],
})
export class GcBranchSwitcher {
 protected readonly auth=inject(GcAuthFacade);
 protected readonly choices=computed(()=> (this.auth.identity()?.branches??[]).map(b=>({id:b.id,label:b.name})));
}
