import {Component} from '@angular/core';
import {FormControl,ReactiveFormsModule} from '@angular/forms';
import {TestBed} from '@angular/core/testing';
import {GcSearchSelect} from './gc-search-select';

@Component({
 imports:[ReactiveFormsModule,GcSearchSelect],
 template:`<gc-search-select id="unit" label="Unidad base" [items]="options" [formControl]="unit"/>`
})
class FormHost {
 readonly options=[{id:'ml',label:'Mililitros'},{id:'kg',label:'Kilogramos'}];
 readonly unit=new FormControl('ml',{nonNullable:true});
}
describe('GcSearchSelect — reactive form integration',()=>{
 it('renders one searchable control and follows programmatic value changes',async()=>{
  const fixture=TestBed.createComponent(FormHost);
  fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('select')).toBeNull();
  expect(fixture.nativeElement.querySelectorAll('input').length).toBe(1);
  expect(fixture.nativeElement.querySelector('.ng-value-label')?.textContent).toContain('Mililitros');
  fixture.componentInstance.unit.setValue('kg');
  fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.ng-value-label')?.textContent).toContain('Kilogramos');
 });
});
