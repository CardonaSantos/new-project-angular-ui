
import {ChangeDetectionStrategy,Component,computed,forwardRef,input,output,signal} from '@angular/core';
import {ControlValueAccessor,FormsModule,NG_VALUE_ACCESSOR} from '@angular/forms';
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
 providers:[{provide:NG_VALUE_ACCESSOR,useExisting:forwardRef(()=>GcSearchSelect),multi:true}],
 template:`
  <div class="gc-select-field">
   <label [for]="id()">{{label()}}</label>
   <ng-select class="gc-select-control"
    [labelForId]="id()"
    [items]="items()" bindLabel="label" bindValue="id"
    [title]="selectedLabel()"
    [ngModel]="displayValue()" [ngModelOptions]="{standalone:true}"
    (ngModelChange)="choose($event)" (blur)="touch()"
    [searchable]="searchable()" [clearable]="clearable()"
    [loading]="loading()" [readonly]="isDisabled()"
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
export class GcSearchSelect implements ControlValueAccessor {
 readonly id=input.required<string>();
 readonly label=input.required<string>();
 readonly items=input<GcSelectOption[]>([]);
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
 private readonly formBound=signal(false);
 private readonly formValue=signal('');
 private readonly formDisabled=signal(false);
 private onControlChange:(value:string)=>void=()=>undefined;
 private onControlTouched:()=>void=()=>undefined;
 protected readonly displayValue=computed(()=>this.formBound()?this.formValue():this.value());
 protected readonly selectedLabel=computed(()=>
  this.items().find(option=>option.id===this.displayValue())?.label??'');
 protected readonly isDisabled=computed(()=>this.disabled()||this.formDisabled());
 protected readonly matchAny=()=>true;
 writeValue(value:string|null):void{
  this.formBound.set(true);this.formValue.set(value??'');
 }
 registerOnChange(callback:(value:string)=>void):void{this.onControlChange=callback}
 registerOnTouched(callback:()=>void):void{this.onControlTouched=callback}
 setDisabledState(disabled:boolean):void{this.formDisabled.set(disabled)}
 protected touch():void{this.onControlTouched()}
 protected choose(value:string|null):void{
  const next=value??'';
  this.formValue.set(next);
  this.onControlChange(next);
  this.valueChange.emit(next);
 }
}
