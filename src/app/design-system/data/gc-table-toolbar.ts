import { Component, input, output } from '@angular/core';

@Component({
  selector: 'gc-table-toolbar',
  template: `
    <div class="gc-toolbar">
      <label class="gc-search">
        <span class="gc-visually-hidden">{{ searchLabel() }}</span>
        <input type="search" [value]="query()" [placeholder]="searchLabel()"
          (input)="queryChange.emit($any($event.target).value)" />
      </label>
      <div class="gc-toolbar-actions"><ng-content select="[gcToolbarActions]" /></div>
    </div>
  `,
  styles: [ `
    .gc-toolbar { display:flex; flex-wrap:wrap; gap:.75rem; align-items:center; justify-content:space-between; }
    .gc-search { flex:1 1 14rem; max-width:28rem; }
    input {
      display:block; width:100%; min-height:var(--gc-control-height);
      padding:.55rem .8rem; border:1px solid var(--gc-outline);
      border-radius:calc(var(--gc-radius) * .65);
      background:var(--gc-surface); color:var(--gc-on-surface);
    }
    input:focus-visible { outline:2px solid var(--gc-primary); outline-offset:2px; }
    .gc-toolbar-actions { display:flex; align-items:center; flex-wrap:wrap; gap:.65rem; }
    .gc-visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
  ` ],
})
export class GcTableToolbar {
  readonly query = input('');
  readonly searchLabel = input('Buscar registros');
  readonly queryChange = output<string>();
}
