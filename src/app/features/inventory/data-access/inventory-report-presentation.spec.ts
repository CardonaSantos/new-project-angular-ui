import {inventoryMasterGroups,inventoryTypes,inventoryReconciliationRows} from './inventory-report-presentation';

describe('Inventory masters report display',()=>{
 it('reads nested counts rather than treating them as an empty report',()=>{
  const report={
   articulos:{alcance:'GLOBAL',total:7,activos:6,inactivos:1,conFotografia:2,
    porTipo:[{tipo:'EMPAQUE',total:3},{tipo:'INGREDIENTE',total:4}]},
   unidades:{total:4,conversiones:3},almacenes:{total:2,activos:1},
   ubicaciones:{total:3,activas:2,recepcionActivas:1}
  };
  expect(inventoryMasterGroups(report).map(x=>[x.title,x.metrics[0].value])).toEqual([
   ['Artículos · catálogo global','7'],['Unidades de medida','4'],
   ['Almacenes de la consulta','2'],['Ubicaciones de la consulta','3']
  ]);
  expect(inventoryTypes(report)).toEqual([
   {label:'Empaque',value:'3'},{label:'Ingrediente',value:'4'}
  ]);
 });
});
describe('Inventory reconciliation presentation',()=>{
 it('shows named discrepancies, without exposing database IDs',()=>{
  const data={diferenciasKardex:[{posicion:'secret-id:secret-location',
   articulo:{codigo:'PAJ',nombre:'Pajillas'},
   ubicacion:{codigo:'REC',nombre:'Recepción'},
   lote:{codigoLote:'LOTE-1'},cantidad:'10.000000',kardex:'11.000000'}]};
  const rows=inventoryReconciliationRows(data,'diferenciasKardex');
  expect(rows).toEqual([{key:'1',article:'Pajillas',location:'Recepción',
   lot:'LOTE-1',expected:'10',actual:'11'}]);
  expect(JSON.stringify(rows)).not.toContain('secret');
  expect(inventoryReconciliationRows({diferenciasCapas:[]},'diferenciasCapas')).toEqual([]);
 });
});
