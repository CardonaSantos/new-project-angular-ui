
import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';

const listing=(view:string,title:string)=>({
 path:'',pathMatch:'full' as const,title:title+' — Gastro Core',
 data:{view},loadComponent:()=>import('./pages/inventory-list-page').then(m=>m.GcInventoryListPage)
});
const create=(view:string,label:string,path:string)=>({
 path,title:label+' — Gastro Core',data:{breadcrumb:label,view},
 canDeactivate:[gcUnsavedChangesGuard],
 loadComponent:()=>view==='article'
    ?import('./pages/inventory-article-page').then(m=>m.GcInventoryArticlePage)
    :import('./pages/inventory-document-create-page').then(m=>m.GcInventoryDocumentCreatePage)
});
export const INVENTORY_ROUTES:Routes=[
 {path:'',pathMatch:'full',redirectTo:'summary'},
 {path:'summary',data:{breadcrumb:'Resumen'},title:'Resumen de inventario — Gastro Core',
  loadComponent:()=>import('./pages/inventory-summary-page').then(m=>m.GcInventorySummaryPage)},
 {path:'articles',data:{breadcrumb:'Artículos'},children:[
  listing('articles','Artículos'),create('article','Nuevo artículo','new'),
  create('article','Detalle del artículo',':id')
 ]},
 {path:'stock',data:{breadcrumb:'Existencias'},children:[
  listing('stock','Existencias'),
  {path:'lots',data:{breadcrumb:'Lotes',view:'lots'},title:'Lotes — Gastro Core',
   loadComponent:()=>import('./pages/inventory-list-page').then(m=>m.GcInventoryListPage)}
 ]},
 {path:'operations',data:{breadcrumb:'Operaciones'},children:[
  {path:'movements',data:{breadcrumb:'Kardex'},children:[
   listing('movements','Kardex'),
   {path:':id',data:{breadcrumb:'Detalle del movimiento',view:'movement'},
    title:'Movimiento — Gastro Core',
    loadComponent:()=>import('./pages/inventory-document-page').then(m=>m.GcInventoryDocumentPage)}
  ]},
  {path:'manual',data:{breadcrumb:'Registrar movimiento'},title:'Movimiento manual — Gastro Core',
   canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/inventory-operation-page').then(m=>m.GcInventoryOperationPage)},
  {path:'counts',data:{breadcrumb:'Conteos'},children:[
   listing('counts','Conteos'),create('count','Nuevo conteo','new'),
   {path:':id',data:{breadcrumb:'Detalle del conteo',view:'count'},title:'Conteo — Gastro Core',
    loadComponent:()=>import('./pages/inventory-document-page').then(m=>m.GcInventoryDocumentPage)}
  ]},
  {path:'transfers',data:{breadcrumb:'Transferencias'},children:[
   listing('transfers','Transferencias'),create('transfer','Nueva transferencia','new'),
   {path:':id',data:{breadcrumb:'Detalle de transferencia',view:'transfer'},
    title:'Transferencia — Gastro Core',
    loadComponent:()=>import('./pages/inventory-document-page').then(m=>m.GcInventoryDocumentPage)}
  ]}
 ]},
 {path:'settings',data:{breadcrumb:'Configuración'},children:[
  {path:'',pathMatch:'full',redirectTo:'warehouses'},
  {path:'warehouses',data:{breadcrumb:'Almacenes y ubicaciones'},
   title:'Almacenes — Gastro Core',canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/inventory-settings-page').then(m=>m.GcInventorySettingsPage)},
  {path:'units',data:{breadcrumb:'Unidades y conversiones'},
   title:'Unidades — Gastro Core',canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/inventory-units-page').then(m=>m.GcInventoryUnitsPage)}
 ]},
 {path:'reports',data:{breadcrumb:'Reportes'},title:'Reportes de inventario — Gastro Core',
  loadComponent:()=>import('./pages/inventory-reports-page').then(m=>m.GcInventoryReportsPage)}
];
