import {TestBed} from '@angular/core/testing';
import {GcKitchenModifiers} from './orders-ui';

describe('Comandas: visualización de modificadores guardados',()=>{
 it('shows names and quantities of the selected toppings',()=>{
  TestBed.configureTestingModule({imports:[GcKitchenModifiers]});
  const fixture=TestBed.createComponent(GcKitchenModifiers);
  fixture.componentRef.setInput('modifiers',[
   {id:'m1',modificadorId:'canela',nombreSnapshot:'Canela espolvoreada',cantidad:1,recargoUnitario:'1.50'},
   {id:'m2',modificadorId:'azucar',nombreSnapshot:'Añadir 2 terrones de azúcar',cantidad:2,recargoUnitario:'0.50'}
  ]);
  fixture.detectChanges();
  const host=fixture.nativeElement as HTMLElement;
  expect(host.textContent).toContain('Personalización');
  expect(host.textContent).toContain('Canela espolvoreada');
  expect(host.textContent).toContain('2 × Añadir 2 terrones de azúcar');
  expect(host.querySelectorAll('li').length).toBe(2);
  expect(host.textContent).not.toContain('1.50');
 });
 it('does not show an empty personalization section',()=>{
  TestBed.configureTestingModule({imports:[GcKitchenModifiers]});
  const fixture=TestBed.createComponent(GcKitchenModifiers);
  fixture.componentRef.setInput('modifiers',[]);
  fixture.detectChanges();
  expect((fixture.nativeElement as HTMLElement).querySelector('.ord-kitchen-modifiers')).toBeNull();
 });
});
