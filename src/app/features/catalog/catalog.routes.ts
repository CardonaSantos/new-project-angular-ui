import type {Routes} from '@angular/router';
import {gcUnsavedChangesGuard} from '../../core/ux/gc-unsaved-changes.guard';

export const CATALOG_ROUTES:Routes=[
 {path:'',pathMatch:'full',redirectTo:'summary'},
 {path:'summary',title:'Resumen de catálogo — Gastro Core',
  data:{breadcrumb:'Resumen'},
  loadComponent:()=>import('./pages/catalog-summary-page').then(m=>m.GcCatalogSummaryPage)},
 {path:'products',data:{breadcrumb:'Productos'},children:[
  {path:'',pathMatch:'full',title:'Productos — Gastro Core',
   loadComponent:()=>import('./pages/catalog-products-page').then(m=>m.GcCatalogProductsPage)},
  {path:'new',title:'Nuevo producto — Gastro Core',data:{breadcrumb:'Nuevo producto'},
   canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/catalog-product-detail-page').then(m=>m.GcCatalogProductDetailPage)},
  {path:':id',title:'Detalle de producto — Gastro Core',data:{breadcrumb:'Detalle del producto'},
   canDeactivate:[gcUnsavedChangesGuard],
   loadComponent:()=>import('./pages/catalog-product-detail-page').then(m=>m.GcCatalogProductDetailPage)}
 ]},
 {path:'categories',title:'Categorías — Gastro Core',data:{breadcrumb:'Categorías'},
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/catalog-categories-page').then(m=>m.GcCatalogCategoriesPage)},
 {path:'extras',title:'Extras — Gastro Core',data:{breadcrumb:'Extras'},
  canDeactivate:[gcUnsavedChangesGuard],
  loadComponent:()=>import('./pages/catalog-extras-page').then(m=>m.GcCatalogExtrasPage)},
 {path:'prices',title:'Precios — Gastro Core',data:{breadcrumb:'Precios'},
  loadComponent:()=>import('./pages/catalog-prices-page').then(m=>m.GcCatalogPricesPage)}
];
