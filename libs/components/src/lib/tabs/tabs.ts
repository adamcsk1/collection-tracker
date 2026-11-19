import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChildren } from '@angular/core';
import type { TabOption } from './tabs-model';

@Component({
  selector: 'libc-tabs',
  templateUrl: './tabs.html',
  styleUrl: './tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs<TValue extends string> {
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  public readonly options = input.required<
    readonly [TabOption<TValue>, TabOption<TValue>] | readonly [TabOption<TValue>, TabOption<TValue>, TabOption<TValue>]
  >();
  public readonly selected = input.required<TValue>();
  public readonly selectedChange = output<TValue>();
  public readonly ariaLabel = input.required<string>();
  public readonly idPrefix = input.required<string>();

  protected isSelected(index: number): boolean {
    return this.selected() === this.options()[index]!.value;
  }

  protected tabId(index: number): string {
    return `${this.idPrefix()}-tab-${index + 1}`;
  }

  protected panelId(index: number): string {
    return `${this.idPrefix()}-panel-${index + 1}`;
  }

  protected panelTestId(index: number): string {
    return `${this.idPrefix()}-${['first', 'second', 'third'][index]}-panel`;
  }

  protected onSelect(index: number): void {
    if (this.options()[index]!.disabled) return;
    this.selectedChange.emit(this.options()[index]!.value);
  }

  public focusSelected(): void {
    const index = this.options().findIndex((option) => option.value === this.selected());
    this.tabButtons()[index]?.nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    let targetIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        targetIndex = (index + 1) % this.options().length;
        break;
      case 'ArrowLeft':
        targetIndex = (index - 1 + this.options().length) % this.options().length;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = this.options().length - 1;
        break;
    }
    if (targetIndex === null) return;
    const direction = event.key === 'ArrowLeft' || event.key === 'End' ? -1 : 1;
    for (let count = 0; this.options()[targetIndex]!.disabled && count < this.options().length; count++) {
      targetIndex = (targetIndex + direction + this.options().length) % this.options().length;
    }
    if (this.options()[targetIndex]!.disabled) return;

    event.preventDefault();
    this.onSelect(targetIndex);
    this.tabButtons()[targetIndex].nativeElement.focus();
  }
}
