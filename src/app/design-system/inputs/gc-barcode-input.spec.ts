import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { GcBarcodeInput } from './gc-barcode-input';

describe('GcBarcodeInput', () => {
  it('emits a normalized scan and blocks an immediate duplicate', async () => {
    await TestBed.configureTestingModule({ imports: [GcBarcodeInput] }).compileComponents();
    const fixture = TestBed.createComponent(GcBarcodeInput);
    const control = new FormControl(' 7501234567890 ', { nonNullable: true });
    fixture.componentRef.setInput('inputId', 'demo-scan');
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('clearOnScan', false);
    const codes: string[] = [];
    fixture.componentInstance.scan.subscribe((event) => codes.push(event.code));
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button');
    button?.click();
    button?.click();
    expect(codes).toEqual(['7501234567890']);
  });

  it('rejects codes shorter than the configured minimum', async () => {
    await TestBed.configureTestingModule({ imports: [GcBarcodeInput] }).compileComponents();
    const fixture = TestBed.createComponent(GcBarcodeInput);
    fixture.componentRef.setInput('inputId', 'short-scan');
    fixture.componentRef.setInput('control', new FormControl('12', { nonNullable: true }));
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('entre 3 y 128');
  });
});
