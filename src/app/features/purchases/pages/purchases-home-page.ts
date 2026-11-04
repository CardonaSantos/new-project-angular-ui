import {Component,inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {PurchasesAccess} from '../data-access/purchases-access';
import {GcPurchasesNav} from '../purchases-nav';
@Component({
 selector:'gc-purchases-home-page',imports:[RouterLink,GcPurchasesNav],
 template:`<main class="pur-page"><gc-purchases-nav/>
  <header class="pur-heading"><h1>Compras y abastecimiento</h1></header>
  <section class="pur-card"><h2>¿Qué necesitas hacer?</h2>
   <div class="pur-choice-grid">
    @if(access.canQuickEntry()){<a routerLink="/purchases/quick">
     <strong>Registrar entrada rápida</strong>
     <span>Sumar insumos directamente al inventario.</span>
    </a>}
    @if(access.canReceiptsCreate()){<a routerLink="/purchases/receipts/new">
     <strong>Recibir mercancía</strong>
     <span>Registrar lo que llegó de un proveedor.</span>
    </a>}
    @if(access.canRead()){<a routerLink="/purchases/receipts">
     <strong>Consultar recepciones</strong>
     <span>Borradores, entradas confirmadas y movimientos.</span>
    </a>}
    @if(access.canSupplyRequest()){<a routerLink="/purchases/requisitions">
     <strong>Solicitar insumos</strong><span>Requisición a otro almacén.</span>
    </a>}
   </div>
  </section>
 </main>`,
 styleUrl:'../purchases.scss'
})
export class GcPurchasesHomePage {protected readonly access=inject(PurchasesAccess)}
