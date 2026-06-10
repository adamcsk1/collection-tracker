import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';
import { PortalService } from '@services/portal-service';
import { AiSearchDialog } from './ai-search-dialog';

@Component({
  selector: 'ct-ai-search-input',
  imports: [],
  templateUrl: './ai-search-input.html',
  styleUrl: './ai-search-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSearchInput {
  private readonly portal = inject(PortalService);
  public readonly formField = input.required<FieldTree<string>>();
  public readonly placeholder = input<string>('');
  public readonly sendEvent = output<void>();

  protected currentValue(): string {
    return this.formField()().value() ?? '';
  }

  protected onExpand(): void {
    this.portal.open(AiSearchDialog, {
      formField: this.formField(),
      placeholder: this.placeholder(),
      send: () => this.sendEvent.emit(),
    });
  }
}
