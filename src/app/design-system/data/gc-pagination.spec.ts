import { TestBed } from '@angular/core/testing';
import { GcPagination, GcPageChange } from './gc-pagination';

describe('GcPagination', () => {
  it('shows the correct page range and emits next page', async () => {
    await TestBed.configureTestingModule({ imports: [GcPagination] }).compileComponents();
    const fixture = TestBed.createComponent(GcPagination);
    fixture.componentRef.setInput('index', 1);
    fixture.componentRef.setInput('size', 5);
    fixture.componentRef.setInput('total', 17);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('6–10 de 17');
    const emitted: GcPageChange[] = [];
    fixture.componentInstance.change.subscribe((event) => emitted.push(event));
    const next = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]');
    next?.click();
    expect(emitted).toEqual([{ index: 2, size: 5 }]);
  });

  it('disables previous page at index zero', async () => {
    await TestBed.configureTestingModule({ imports: [GcPagination] }).compileComponents();
    const fixture = TestBed.createComponent(GcPagination);
    fixture.componentRef.setInput('index', 0);
    fixture.componentRef.setInput('total', 4);
    fixture.detectChanges();
    const prev = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Página anterior"]');
    expect(prev?.disabled).toBe(true);
  });
});
