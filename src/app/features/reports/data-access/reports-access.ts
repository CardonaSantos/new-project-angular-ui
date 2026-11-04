import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
import type {ReportSource} from './reports.models';
/** Every report read still requires backend authorization; this only governs UI visibility. */
const SOURCE_PERMISSION:Record<ReportSource,string>={
 SALES_LINES:'sales.read',INVENTORY_MOVEMENTS:'inventory.reports.read',
 PURCHASE_INVOICES:'purchases.read',PURCHASE_RECEIPT_LINES:'purchases.read',
 DELIVERY_EVENTS:'delivery.read',RESERVATION_EVENTS:'reservations.read',
 SUPPLY_REQUESTS:'supply.read',SUPPLY_TRANSFERS:'supply.read',
 PREPARATION_COSTS:'inventory.costs.read',SALES_COSTS:'sales.read',
 ORDER_COST_OUTCOMES:'inventory.costs.read',
 PAYMENT_SALES_RECON:'payments.read',SUPPLIER_BALANCES:'purchases.read',
 PLATFORM_SETTLEMENTS:'delivery.platform.manage',BANK_MATCH_STATUS:'finance.statements.read'
};
@Injectable({providedIn:'root'})
export class ReportsAccess {
 private readonly branch=inject(GcBranchContext);
 private readonly org=inject(OrganizationAccess);
 can(permission:string){return this.branch.has(permission)||this.org.canGlobal(permission)}
 canRead(){return this.can('reports.read')}
 canSource(source:ReportSource){
  return this.canRead()&&this.can(SOURCE_PERMISSION[source])&&
   (source!=='SALES_COSTS'||this.can('inventory.costs.read'))&&
   (source!=='ORDER_COST_OUTCOMES'||this.can('orders.read'));
 }
 canConsolidate(){return this.canRead()&&this.can('sales.read')&&this.can('payments.read')}
}
