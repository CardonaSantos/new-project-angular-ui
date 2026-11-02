
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute,Router,convertToParamMap} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {vi} from 'vitest';
import {GcBranchContext} from '../../../core/organization/gc-branch-context';
import {InventoryUrlState,sanitizeInventoryPage} from './inventory-url-state';

describe('Inventory URL state — reload and history contract',()=>{
 const query=new BehaviorSubject(convertToParamMap({
  sucursalId:'b1',page:'3',limit:'25',search:'leche',estado:'BORRADOR'
 }));
 const branch={
  branches:signal([{id:'b1',nombre:'Central'},{id:'b2',nombre:'Norte'}]),
  branchId:signal('b1')
 };
 const navigate=vi.fn().mockResolvedValue(true);
 let state:InventoryUrlState;
 beforeEach(()=>{
  query.next(convertToParamMap({sucursalId:'b1',page:'3',limit:'25',search:'leche',estado:'BORRADOR'}));
  navigate.mockClear();
  TestBed.configureTestingModule({
   providers:[
    InventoryUrlState,
    {provide:ActivatedRoute,useValue:{queryParamMap:query.asObservable(),
      snapshot:{queryParamMap:query.value}}},
    {provide:Router,useValue:{navigate}},
    {provide:GcBranchContext,useValue:branch}
   ]
  });
  state=TestBed.inject(InventoryUrlState);
 });
 it('restores all recognized filters and pagination from the query string',()=>{
  expect(state.filters()).toMatchObject({
   sucursalId:'b1',page:3,limit:25,search:'leche',estado:'BORRADOR'
  });
 });
 it('updates its query state on browser Back/Forward without component recreation',()=>{
  query.next(convertToParamMap({sucursalId:'b2',page:'1',tipo:'INGREDIENTE'}));
  expect(state.filters()).toMatchObject({sucursalId:'b2',page:1,tipo:'INGREDIENTE'});
  query.next(convertToParamMap({sucursalId:'b1',page:'3',limit:'25',search:'leche'}));
  expect(state.filters()).toMatchObject({sucursalId:'b1',page:3,search:'leche'});
 });
 it('persists filters without losing other URL parameters or pushing redundant page=1',async()=>{
  await state.patch({estado:'CONFIRMADO',page:1});
  expect(navigate).toHaveBeenCalledWith([],expect.objectContaining({
   queryParams:{estado:'CONFIRMADO',page:null},
   queryParamsHandling:'merge',replaceUrl:false
  }));
  await state.patch({section:'locations',sucursalId:'b2'});
  expect(navigate).toHaveBeenCalledWith([],expect.objectContaining({
   queryParams:{section:'locations',sucursalId:'b2'}
  }));
 });
 it('bounds page and size and does not trust unauthorized URL branch IDs',()=>{
  query.next(convertToParamMap({sucursalId:'forbidden',page:'-1',limit:'100000'}));
  expect(state.filters().sucursalId).toBe('b1');
  expect(state.filters().page).toBe(1);
  expect(state.filters().limit).toBe(20);
  expect(sanitizeInventoryPage('0',1,100)).toBe(1);
  expect(sanitizeInventoryPage('5',1,100)).toBe(5);
 });
});
