import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {GcSessionService} from '../../../core/auth/gc-session.service';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {OrdersPreferences} from './orders-preferences';

describe('POS operator preferences',()=>{
 const key=(b:string)=>'gc:pos:preferences:v1:test-user::'+b;
 afterEach(()=>{
  localStorage.removeItem(key('branch-1'));
  localStorage.removeItem(key('branch-2'));
  TestBed.resetTestingModule();
 });
 it('remembers Mostrador/Mesas and product display across component reloads',()=>{
  localStorage.removeItem(key('branch-1'));
  const user=signal({id:'test-user'});
  const branchId=signal<string|null>('branch-1');
  TestBed.configureTestingModule({providers:[
   {provide:GcSessionService,useValue:{user}},
   {provide:GcBranchContext,useValue:{branchId}},
  ]});
  const first=TestBed.inject(OrdersPreferences);
  first.load();
  expect(first.view()).toBe('counter');
  expect(first.productLayout()).toBe('visual');
  first.setView('tables');
  first.setLayout('compact');
  const reloaded=TestBed.runInInjectionContext(()=>new OrdersPreferences());
  reloaded.load();
  expect(reloaded.view()).toBe('tables');
  expect(reloaded.productLayout()).toBe('compact');
  branchId.set('branch-2');
  reloaded.load();
  expect(reloaded.view()).toBe('counter');
  expect(reloaded.productLayout()).toBe('visual');
 });
});
