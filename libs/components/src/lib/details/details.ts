import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_PREFIX } from '@shared/constants/storage-const';

@Component({
  selector: 'libc-details',
  templateUrl: './details.html',
  styleUrl: './details.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Details implements OnInit {
  private readonly webstorage = inject(WebstorageService);
  private get storageKey(): string {
    return `${STORAGE_PREFIX}Details${this.summary()}`;
  }
  protected readonly storedOpened = signal<boolean>(false);
  public readonly open = input(false);
  public readonly summary = input.required<string>();
  public readonly storeOpenedState = input(true);

  public ngOnInit(): void {
    if (this.storeOpenedState()) {
      this.storedOpened.set(this.webstorage.getItem(this.storageKey) === 'true');
    }
  }

  public onToggle(event: Event): void {
    if (this.storeOpenedState()) {
      const open = !((event.target as HTMLElement).parentElement as HTMLDetailsElement)?.open;
      this.webstorage.setItem(this.storageKey, open.toString());
    }
  }
}
