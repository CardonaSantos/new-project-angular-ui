import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { GcDecimalInput } from './gc-decimal-input';

describe('GcDecimalInput', () => {
  it('never rounds excess decimal digits and updates control validity', async () => {
    await TestBed.configureTestingModule({ imports: [GcDecimalInput] }).compileComponents();
    const fixture = TestBed.createComponent(GcDecimalInput);
    const control = new FormControl('12.345', { nonNullable: true });
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('inputId', 'demo-money');
    fixture.componentRef.setInput('label', 'Precio');
    fixture.componentRef.setInput('scale', 2);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    input?.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(control.value).toBe('12.345');
    expect(control.hasError('gcDecimal')).toBe(true);

    control.setValue('12.5');
    input?.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(control.value).toBe('12.50');
    expect(control.hasError('gcDecimal')).toBe(false);
  });

  it('flags values below the configured minimum', async () => {
    await TestBed.configureTestingModule({ imports: [GcDecimalInput] }).compileComponents();
    const fixture = TestBed.createComponent(GcDecimalInput);
    const control = new FormControl('-1', { nonNullable: true });
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('inputId', 'demo-negative');
    fixture.componentRef.setInput('label', 'Cantidad');
    fixture.componentRef.setInput('min', '0');
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('input')?.dispatchEvent(new Event('blur'));
    expect(control.invalid).toBe(true);
  });
});
