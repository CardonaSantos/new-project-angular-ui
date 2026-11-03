import { describe, expect, it } from 'vitest';
import { gcSelectField } from './formly-field-factory';
import { GcFormlySelectType } from './gc-formly-select.type';

describe('Formly searchable select',()=>{
 it('uses the shared Angular selector rather than a Material/native select',()=>{
  const options=[{label:'Bebida',value:'Bebida'},{label:'Alimento',value:'Alimento'}];
  const field=gcSelectField('categoria','Categoría',options,true);
  expect(field.type).toBe(GcFormlySelectType);
  expect(field.props?.required).toBe(true);
  expect(field.props?.options).toEqual(options);
 });
});
