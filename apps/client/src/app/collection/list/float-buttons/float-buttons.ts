import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { ClaudeSearchService } from '@client/collection/search/claude-search-service';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { mainStateToken } from '@client/main/main-store';
import { ImageIcon } from '@components/image-icon/image-icon';
import { apiStateToken } from '@services/api/api-store';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-float-buttons',
  templateUrl: './float-buttons.html',
  styleUrl: './float-buttons.css',
  imports: [NgxSignalTranslatePipe, ImageIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatButtons {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly mainState = inject(mainStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly claudeSearch = inject(ClaudeSearchService);

  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly collectionLength = computed(() => this.mainCollectionState.state.collection().length);
  protected readonly claudeAiAvailable = this.mainState.state.claudeAiAvailable;
  protected readonly useClaudeAi = this.claudeSearch.useClaudeAi.asReadonly();
  protected readonly permissionAdd = computed(() => this.mainState.state.permissions().create);

  public readonly randomPick = output<void>();
  public readonly toggleClaudeAi = output<void>();
  public readonly addNew = output<void>();
}
