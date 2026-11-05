import { FormlyFieldConfig } from '@ngx-formly/core';
import { GcFormlySelectType } from './gc-formly-select.type';

export function gcTextField(key:string,label:string,required=false):FormlyFieldConfig{
 return {key,type:'input',props:{label,required}};
}

export function gcSelectField(
 key:string,label:string,
 options:readonly {label:string;value:string}[],
 required=false,
):FormlyFieldConfig{
 return {key,type:GcFormlySelectType,props:{label,required,options:[...options]}};
}
