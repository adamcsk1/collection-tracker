import { ChangeDetectionStrategy, Component, ElementRef, input, model, viewChildren } from '@angular/core';
import type { TabOption } from './tabs-model';

@Component({
  selector: 'libc-tabs',
  templateUrl: './tabs.html',
  styleUrl: './tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs<TValue extends string> {
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  public readonly options = input.required<readonly [TabOption<TValue>, TabOption<TValue>]>();
  public readonly selected = model.required<TValue>();
  public readonly ariaLabel = input.required<string>();
  public readonly idPrefix = input.required<string>();

  protected isSelected(index: number): boolean {
    return this.selected() === this.options()[index].value;
  }

  protected tabId(index: number): string {
    return `${this.idPrefix()}-tab-${index + 1}`;
  }

  protected panelId(index: number): string {
    return `${this.idPrefix()}-panel-${index + 1}`;
  }

  protected panelTestId(index: number): string {
    return `${this.idPrefix()}-${index === 0 ? 'first' : 'second'}-panel`;
  }

  protected onSelect(index: number): void {
    if (this.options()[index].disabled) return;
    this.selected.set(this.options()[index].value);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    let targetIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        targetIndex = index === 0 ? 1 : 0;
        break;
      case 'ArrowLeft':
        targetIndex = index === 0 ? 1 : 0;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = 1;
        break;
    }
    if (targetIndex === null || this.options()[targetIndex].disabled) return;

    event.preventDefault();
    this.onSelect(targetIndex);
    this.tabButtons()[targetIndex].nativeElement.focus();
  }
}
