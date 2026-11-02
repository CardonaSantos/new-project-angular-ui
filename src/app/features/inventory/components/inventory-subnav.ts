
import {Component,input} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
@Component({
 selector:'gc-inventory-subnav',imports:[RouterLink,RouterLinkActive],
 template:`
 <nav class="inv-subnav" [attr.aria-label]="label()">
  @for(item of links();track item.path){
   <a [routerLink]="item.path" routerLinkActive="active"
    [routerLinkActiveOptions]="{exact:item.exact??true}"
    ariaCurrentWhenActive="page">{{item.label}}</a>
  }
 </nav>`,
 styleUrl:'../inventory.scss'
})
export class GcInventorySubnav{
 readonly label=input('Navegación de sección');
 readonly links=input.required<readonly {path:string;label:string;exact?:boolean}[]>();
}
export const OPERATION_LINKS=[
 {path:'/inventory/operations/movements',label:'Kardex',exact:false},
 {path:'/inventory/operations/manual',label:'Registrar movimiento'},
 {path:'/inventory/operations/counts',label:'Conteos',exact:false},
 {path:'/inventory/operations/transfers',label:'Transferencias',exact:false}
] as const;
export const SETTINGS_LINKS=[
 {path:'/inventory/settings/warehouses',label:'Almacenes y ubicaciones'},
 {path:'/inventory/settings/units',label:'Unidades y conversiones'}
] as const;
export const STOCK_LINKS=[
 {path:'/inventory/stock',label:'Existencias'},
 {path:'/inventory/stock/lots',label:'Lotes'}
] as const;
