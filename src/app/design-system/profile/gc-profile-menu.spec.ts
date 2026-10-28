import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatMenuTrigger } from '@angular/material/menu';
import { GcProfileMenu } from './gc-profile-menu';

describe('GcProfileMenu', () => {
  it('closes after clicking outside the profile menu', async () => {
    await TestBed.configureTestingModule({
      imports: [GcProfileMenu],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(GcProfileMenu);
    const overlay = TestBed.inject(OverlayContainer);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger);

    trigger.openMenu();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger.menuOpen).toBe(true);

    const backdrop = overlay.getContainerElement().querySelector<HTMLElement>('.cdk-overlay-backdrop');
    expect(backdrop).not.toBeNull();
    backdrop?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(trigger.menuOpen).toBe(false);
    overlay.ngOnDestroy();
  });

  it('closes if navigation starts while it is open', async () => {
    await TestBed.configureTestingModule({
      imports: [GcProfileMenu],
      providers: [provideRouter([{ path: 'lab/behaviors', component: GcProfileMenu }])],
    }).compileComponents();

    const fixture = TestBed.createComponent(GcProfileMenu);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger);
    trigger.openMenu();
    fixture.detectChanges();
    expect(trigger.menuOpen).toBe(true);
    await TestBed.inject(Router).navigateByUrl('/lab/behaviors');
    expect(trigger.menuOpen).toBe(false);
  });
});
