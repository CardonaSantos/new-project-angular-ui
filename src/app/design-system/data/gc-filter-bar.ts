import { Component, computed, input, output } from '@angular/core';
import { GcSearchSelect } from '../forms/gc-search-select';

export interface GcFilterOption { label: string; value: string; }

/** Consistent filter field for list views; retains the existing value/options API. */
@Component({
 selector:'gc-filter-bar',
 imports:[GcSearchSelect],
 template:`
  <gc-search-select [id]="filterId()" [label]="label()" [items]="items()"
   [value]="value()" [searchable]="items().length>7" [clearable]="false"
   (valueChange)="valueChange.emit($event)"/>
 `,
 styles:[`:host{display:block;min-width:0;width:100%}`],
})
export class GcFilterBar {
 readonly filterId=input.required<string>();
 readonly label=input.required<string>();
 readonly options=input.required<readonly GcFilterOption[]>();
 readonly value=input('');
 readonly valueChange=output<string>();
 protected readonly items=computed(()=>this.options().map(x=>({id:x.value,label:x.label})));
}
