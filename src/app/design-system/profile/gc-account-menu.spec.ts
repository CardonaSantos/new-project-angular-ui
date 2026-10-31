import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MatMenuTrigger } from '@angular/material/menu';
import { OverlayContainer } from '@angular/cdk/overlay';
import { GcSessionService } from '../../core/auth/gc-session.service';
import { GcAccountMenu } from './gc-account-menu';

describe('GcAccountMenu', () => {
  it('shows account identity in distinct accessible rows and account actions', async () => {
    await TestBed.configureTestingModule({
      imports: [GcAccountMenu],
      providers: [
        provideRouter([]),
        {
          provide: GcSessionService,
          useValue: {
            user: signal({ id: 'u1', nombre: 'Administradora de prueba',
              email: 'admin@example.com', debeCambiarContrasena: false }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(GcAccountMenu);
    const overlay = TestBed.inject(OverlayContainer);
    fixture.detectChanges();
    const trigger = fixture.debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger);
    trigger.openMenu();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlay.getContainerElement();
    expect(panel.querySelector('.gc-account-panel')).not.toBeNull();
    const name = panel.querySelector<HTMLElement>('.gc-account-info-name');
    const email = panel.querySelector<HTMLElement>('.gc-account-info-email');
    expect(name?.textContent?.trim()).toBe('Administradora de prueba');
    expect(email?.textContent?.trim()).toBe('admin@example.com');
    expect(name?.parentElement).toBe(email?.parentElement);
    expect(name?.parentElement?.classList.contains('gc-account-info')).toBe(true);
    expect(panel.textContent).toContain('Cambiar contraseña');
    expect(panel.textContent).toContain('Cerrar todas las sesiones');

    trigger.closeMenu();
    await fixture.whenStable();
    overlay.ngOnDestroy();
  });
});
