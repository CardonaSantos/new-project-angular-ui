import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {InventoryApi} from '../data-access/inventory.api';
import {GcInventoryPicker} from './inventory-picker';

describe('Shared inventory picker — saved relations',()=>{
 beforeEach(()=>{
  const api={
   articleOptions:()=>of({data:[{id:'other',codigo:'ART-2',nombre:'Otro artículo'}],
    meta:{hasMore:false,nextCursor:null}}),
   article:()=>of({id:'saved',codigo:'ART-1',nombre:'Artículo guardado'})
  };
  TestBed.configureTestingModule({
   imports:[GcInventoryPicker],
   providers:[{provide:InventoryApi,useValue:api}]
  });
 });
 it('shows and selects the current article even when omitted from the first 50 search results',async()=>{
  const f=TestBed.createComponent(GcInventoryPicker);
  f.componentRef.setInput('id','article-picker');
  f.componentRef.setInput('kind','article');
  f.componentRef.setInput('value','saved');
  f.componentRef.setInput('selectedLabel','Artículo guardado');
  f.detectChanges();await f.whenStable();f.detectChanges();
  const selected=f.nativeElement.querySelector('.ng-value-label') as HTMLElement;
  expect(selected?.textContent).toContain('Artículo guardado');
 });
 it('updates the selected label without requiring a new search or clearing the saved ID',async()=>{
  const f=TestBed.createComponent(GcInventoryPicker);
  f.componentRef.setInput('id','article-picker');
  f.componentRef.setInput('kind','article');
  f.componentRef.setInput('value','saved');
  f.componentRef.setInput('selectedLabel','Artículo guardado');
  f.detectChanges();await f.whenStable();
  f.componentRef.setInput('value','new-value');
  f.componentRef.setInput('selectedLabel','Artículo nuevo');
  f.detectChanges();
  // NgModel propagates external writes in a scheduled microtask.
  await f.whenStable();f.detectChanges();
  const selected=f.nativeElement.querySelector('.ng-value-label') as HTMLElement;
  expect(selected?.textContent).toContain('Artículo nuevo');
 });
 it('loads a readable label when the parent did not provide one',async()=>{
  const f=TestBed.createComponent(GcInventoryPicker);
  f.componentRef.setInput('id','article-picker');
  f.componentRef.setInput('kind','article');
  f.componentRef.setInput('value','saved');
  f.detectChanges();await f.whenStable();f.detectChanges();
  const selected=f.nativeElement.querySelector('.ng-value-label') as HTMLElement;
  expect(selected?.textContent).toContain('ART-1 · Artículo guardado');
 });
});
