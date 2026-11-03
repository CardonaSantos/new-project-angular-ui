
import {ChangeDetectionStrategy,Component,input,output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgSelectComponent} from '@ng-select/ng-select';

export interface GcSelectOption {
 id:string;
 label:string;
 disabled?:boolean;
}

/** Single accessible selection field, reusable across domains.
 *  Parent owns selected value and (when remote) the server query.
 */
@Component({
 selector:'gc-search-select',
 imports:[FormsModule,NgSelectComponent],
 changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
  <div class="gc-select-field">
   <label [for]="id()">{{label()}}</label>
   <ng-select class="gc-select-control"
    [labelForId]="id()"
    [items]="items()" bindLabel="label" bindValue="id"
    [ngModel]="value()" [ngModelOptions]="{standalone:true}"
    (ngModelChange)="valueChange.emit($event??'')"
    [searchable]="searchable()" [clearable]="clearable()"
    [loading]="loading()" [readonly]="disabled()"
    [searchFn]="remote()?matchAny:undefined"
    [virtualScroll]="items().length>100"
    [placeholder]="placeholder()"
    [panelClass]="'gc-select-control'"
    loadingText="Consultando…" notFoundText="Sin resultados"
    (search)="searchChange.emit($event.term)"
    (open)="opened.emit()"
    (clear)="searchChange.emit('')"/>
   @if(hint()){<small [id]="id()+'-hint'">{{hint()}}</small>}
   @if(error()){<small class="gc-select-error" role="alert">{{error()}}</small>}
  </div>
 `
})
export class GcSearchSelect {
 readonly id=input.required<string>();
 readonly label=input.required<string>();
 readonly items=input<readonly GcSelectOption[]>([]);
 readonly value=input<string>('');
 readonly placeholder=input('Buscar o seleccionar…');
 readonly searchable=input(true);
 readonly clearable=input(true);
 readonly remote=input(false);
 readonly loading=input(false);
 readonly disabled=input(false);
 readonly hint=input('');
 readonly error=input('');
 readonly valueChange=output<string>();
 readonly searchChange=output<string>();
 readonly opened=output<void>();
 protected readonly matchAny=()=>true;
}
