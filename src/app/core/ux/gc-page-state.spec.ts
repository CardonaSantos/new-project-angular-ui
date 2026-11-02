import { GcPageState } from './gc-page-state';
import { Component, effect, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

@Component({ template: '' })
class InventoryEffectHost {
  readonly filter=signal('b1');
  readonly page=new GcPageState<string>();
  calls=0;
  constructor(){
    effect(()=>{
      const branch=this.filter();
      this.calls++;
      void this.page.load(async()=>branch);
    });
  }
}

describe('GcPageState', () => {
  it('distinguishes ready, empty and error', async () => {
    const state = new GcPageState<string[]>();
    await state.load(async () => ['record'], (rows) => rows.length === 0);
    expect(state.status()).toBe('ready');
    await state.load(async () => [], (rows) => rows.length === 0);
    expect(state.status()).toBe('empty');
    await state.load(async () => { throw new Error('demo'); });
    expect(state.status()).toBe('error');
  });

  it('ignores outdated responses', async () => {
    const state = new GcPageState<string[]>();
    let complete: ((value: string[]) => void) | undefined;
    const first = state.load(() => new Promise<string[]>((resolve) => { complete = resolve; }));
    await state.load(async () => ['new']);
    complete?.(['old']);
    await first;
    expect(state.data()).toEqual(['new']);
  });
  it('does not re-run an effect query when its own page data resolves',async()=>{
    await TestBed.configureTestingModule({imports:[InventoryEffectHost]}).compileComponents();
    const fixture=TestBed.createComponent(InventoryEffectHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.calls).toBe(1);
    expect(fixture.componentInstance.page.status()).toBe('ready');
    expect(fixture.componentInstance.page.data()).toBe('b1');
    fixture.componentInstance.filter.set('b2');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.calls).toBe(2);
    expect(fixture.componentInstance.page.data()).toBe('b2');
    fixture.destroy();
  });

  it('retains resolved rows while a fresh query is in flight',async()=>{
    const page=new GcPageState<string[]>();
    await page.load(async()=>['old']);
    let resolveNew:((value:string[])=>void)|undefined;
    const ongoing=page.load(()=>new Promise<string[]>(resolve=>resolveNew=resolve));
    expect(page.busy()).toBe(true);
    expect(page.data()).toEqual(['old']);
    resolveNew?.(['new']);
    await ongoing;
    expect(page.busy()).toBe(false);
    expect(page.data()).toEqual(['new']);
  });
});
