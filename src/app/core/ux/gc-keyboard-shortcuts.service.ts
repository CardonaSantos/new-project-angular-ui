import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';

export interface GcShortcut {
  key: string;
  handler: (event: KeyboardEvent) => void;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  allowInEditable?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GcKeyboardShortcuts implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly registered = new Set<GcShortcut>();

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const element = event.target;
    const editable = element instanceof HTMLElement &&
      (element.isContentEditable || Boolean(element.closest('input,textarea,select,[contenteditable="true"]')));
    for (const shortcut of this.registered) {
      if (editable && !shortcut.allowInEditable) continue;
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;
      if (Boolean(shortcut.mod) !== (event.ctrlKey || event.metaKey)) continue;
      if (Boolean(shortcut.shift) !== event.shiftKey || Boolean(shortcut.alt) !== event.altKey) continue;
      event.preventDefault();
      shortcut.handler(event);
      break;
    }
  };

  constructor() { this.doc.addEventListener('keydown', this.onKeyDown); }

  register(shortcut: GcShortcut): () => void {
    this.registered.add(shortcut);
    return () => { this.registered.delete(shortcut); };
  }

  ngOnDestroy(): void {
    this.doc.removeEventListener('keydown', this.onKeyDown);
    this.registered.clear();
  }
}
