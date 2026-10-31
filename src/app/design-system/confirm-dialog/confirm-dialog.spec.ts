import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('uses a shared, separated action area with cancel first and confirm last', async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [{
        provide: MAT_DIALOG_DATA,
        useValue: {
          title: 'Cerrar sesión',
          message: '¿Quieres cerrar tu sesión?',
          confirmText: 'Cerrar sesión',
          danger: true,
        },
      }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();

    const actions: HTMLElement | null =
      fixture.nativeElement.querySelector('mat-dialog-actions.gc-confirm-actions');
    expect(actions).not.toBeNull();
    const buttons = actions!.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent?.trim()).toBe('Volver');
    expect(buttons[1].textContent?.trim()).toBe('Cerrar sesión');
    expect(buttons[0].type).toBe('button');
    expect(buttons[1].type).toBe('button');
    expect(buttons[1].classList.contains('gc-button--danger')).toBe(true);
  });

  it('uses the same action layout for normal confirmations', async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [{
        provide: MAT_DIALOG_DATA,
        useValue: { title: 'Confirmar', message: 'Continuar' },
      }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    const actions: HTMLElement =
      fixture.nativeElement.querySelector('mat-dialog-actions.gc-confirm-actions');
    const buttons = actions.querySelectorAll('button');
    expect(buttons[0].textContent?.trim()).toBe('Volver');
    expect(buttons[1].textContent?.trim()).toBe('Confirmar');
  });
});
