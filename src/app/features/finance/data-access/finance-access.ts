
import {inject,Injectable} from '@angular/core';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrganizationAccess} from '../../organization/data-access/organization-access';
@Injectable({providedIn:'root'})
export class FinanceAccess{
 private readonly branch=inject(GcBranchContext);
 private readonly global=inject(OrganizationAccess);
 private can(permission:string){return this.branch.has(permission)||this.global.canGlobal(permission)}
 canRead(){return this.can('finance.read')}
 canAccountsManage(){return this.can('finance.accounts.manage')}
 canExpensesRead(){return this.can('finance.expenses.read')}
 canExpensesCreate(){return this.can('finance.expenses.create')}
 canReconciliationRead(){return this.can('finance.reconciliation.read')}
 canMovementsPost(){return this.can('finance.movements.post')}
 canRoutingRead(){return this.can('finance.routing.read')}
 canRoutingManage(){return this.can('finance.routing.manage')}
 canClosingRead(){return this.can('finance.closing.read')}
 canClosingExecute(){return this.can('finance.closing.execute')}
 canStatementsRead(){return this.can('finance.statements.read')}
 canStatementsImport(){return this.can('finance.statements.import')}
 canStatementsMatch(){return this.can('finance.statements.match')}
 canStatementsOverride(){return this.can('finance.statements.override')}
 canReversalsCreate(){return this.can('finance.reversals.create')}
 canEnter(){return this.canRead()||this.canExpensesRead()||this.canReconciliationRead()||
  this.canRoutingRead()||this.canClosingRead()||this.canStatementsRead()}
}
