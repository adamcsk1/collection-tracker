import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ImageIcon } from '@components/image-icon/image-icon';
import { apiStateToken } from '@services/api/api-store';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { mainStateToken } from '../../../main/main-store';
import { AiSearchService } from '../../search/ai-search-service';

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
  private readonly aiSearch = inject(AiSearchService);

  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly aiAvailable = this.mainState.state.aiAvailable;
  protected readonly useAiSearch = this.aiSearch.useAiSearch.asReadonly();
  protected readonly permissionAdd = computed(() => this.mainState.state.permissions().create);
  protected readonly searchSwitchButtonLabel = computed(() =>
    this.useAiSearch() ? 'SwitchToStandardSearch' : this.aiAvailable() ? 'SwitchToAiSearch' : 'AiSearchOffline'
  );
  protected readonly showFloatButtons = signal(false);
  protected readonly ollamaIcon = `${getBasePath()}/client/images/ollama-icon.png`;

  public readonly scrollToTopAvailable = input<boolean>(false);
  public readonly collectionLength = input.required<number>();

  public readonly randomPick = output<void>();
  public readonly toggleAiSearch = output<void>();
  public readonly addNew = output<void>();
  public readonly scrollToTop = output<void>();
  public readonly showFunctions = output<void>();

  public onShowFunctions(): void {
    this.showFloatButtons.set(true);
    this.showFunctions.emit();
  }

  public onHideFunctions(): void {
    this.showFloatButtons.set(false);
  }

  public onRandomPick(): void {
    this.randomPick.emit();
    this.showFloatButtons.set(false);
  }

  public onToggleAiSearch(): void {
    this.toggleAiSearch.emit();
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
