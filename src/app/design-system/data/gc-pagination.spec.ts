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
    fixture.componentInstance.pageChange.subscribe((event) => emitted.push(event));
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
  it('shows a selectable 20-row page size, matching Inventory default pagination',async()=>{
    await TestBed.configureTestingModule({imports:[GcPagination]}).compileComponents();
    const fixture=TestBed.createComponent(GcPagination);
    fixture.componentRef.setInput('index',0);
    fixture.componentRef.setInput('size',20);
    fixture.componentRef.setInput('total',36);
    fixture.detectChanges();
    const select=fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('20');
    expect(Array.from(select.options).map(o=>o.value)).toContain('20');
    expect(fixture.nativeElement.textContent).toContain('1–20 de 36');
    expect(fixture.nativeElement.textContent).toContain('Página 1 de 2');
    const emitted:GcPageChange[]=[];
    fixture.componentInstance.pageChange.subscribe(x=>emitted.push(x));
    select.value='10';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual([{index:0,size:10}]);
    fixture.destroy();
  });
});
