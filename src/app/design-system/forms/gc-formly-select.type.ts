import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';
import { GcSearchSelect, GcSelectOption } from './gc-search-select';

/** Formly adapter: no native select or Material-only dropdown in dynamic forms. */
@Component({
 selector:'gc-formly-search-select',
 imports:[ReactiveFormsModule,GcSearchSelect],
 template:`
  <gc-search-select [id]="selectId" [label]="selectLabel" [items]="choices"
   [formControl]="formControl" [searchable]="choices.length>7"
   [clearable]="!props.required" [placeholder]="props.required?'Seleccionar…':'Todos / ninguno'"/>
 `,
})
export class GcFormlySelectType extends FieldType<FieldTypeConfig>{
 get selectId():string{return String(this.field.id??'gc-formly-'+String(this.field.key??'select'))}
 get selectLabel():string{return String(this.props.label??'Seleccionar')}
 get choices():GcSelectOption[]{
  const options=this.props.options as readonly {label:string;value:string}[]|undefined;
  return Array.isArray(options)?options.map(o=>({id:o.value,label:o.label})):[];
 }
}
