import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ImageIcon } from '@components/image-icon/image-icon';
import { apiStateToken } from '@services/api/api-store';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { mainStateToken } from '../../../main/main-store';
import { ClaudeSearchService } from '../../search/claude-search-service';

@Component({
  selector: 'ct-float-buttons',
  templateUrl: './float-buttons.html',
  styleUrl: './float-buttons.css',
  imports: [NgxSignalTranslatePipe, ImageIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatButtons {
  private readonly mainState = inject(mainStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly claudeSearch = inject(ClaudeSearchService);

  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly claudeAiAvailable = this.mainState.state.claudeAiAvailable;
  protected readonly useClaudeAi = this.claudeSearch.useClaudeAi.asReadonly();
  protected readonly permissionAdd = computed(() => this.mainState.state.permissions().create);
  protected readonly showFloatButtons = signal(false);

  public readonly scrollToTopAvailable = input<boolean>(false);
  public readonly collectionLength = input.required<number>();

  public readonly randomPick = output<void>();
  public readonly toggleClaudeAi = output<void>();
  public readonly addNew = output<void>();
  public readonly scrollToTop = output<void>();

  public onRandomPick(): void {
    this.randomPick.emit();
    this.showFloatButtons.set(false);
  }

  public onToggleClaudeAi(): void {
    this.toggleClaudeAi.emit();
    this.showFloatButtons.set(false);
  }

  public onAddNew(): void {
    this.addNew.emit();
    this.showFloatButtons.set(false);
  }

  public onScrollToTop(): void {
    this.scrollToTop.emit();
  }
}
