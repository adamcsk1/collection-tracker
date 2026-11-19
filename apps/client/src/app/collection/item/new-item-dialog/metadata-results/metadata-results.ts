import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { apiStateToken } from '@services/api/api-store';
import { getProxyImageUrl } from '@shared/utils/proxy-image-url-util';
import { ListItemCard } from '../../../list/list-item-card/list-item-card';
import { MetadataResultOptionModel } from './metadata-results-model';

@Component({
  selector: 'ct-metadata-results',
  imports: [ListItemCard],
  templateUrl: './metadata-results.html',
  styleUrl: './metadata-results.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetadataResults {
  private readonly apiState = inject(apiStateToken);
  public readonly options = input.required<readonly MetadataResultOptionModel[]>();
  public readonly selectedValue = input<string | null>(null);
  public readonly label = input.required<string>();
  public readonly mandatory = input(false);
  public readonly disabled = input(false);
  public readonly testIdPrefix = input('metadata-results');
  public readonly selected = output<MetadataResultOptionModel>();

  protected imageUrl(option: MetadataResultOptionModel): string {
    return getProxyImageUrl(this.apiState.state.apiUrl(), option.poster ?? '', 'card');
  }

  protected meta(option: MetadataResultOptionModel): string | null {
    const details = [option.year, option.actors].filter(Boolean).join(' · ');
    if (option.contentType && details) return `(${option.contentType}) ${details}`;
    if (option.contentType) return `(${option.contentType})`;
    return details || null;
  }

  protected onSelect(option: MetadataResultOptionModel): void {
    if (!this.disabled() && !option.disabled) this.selected.emit(option);
  }
}
