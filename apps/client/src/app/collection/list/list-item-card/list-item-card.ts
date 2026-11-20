import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ListItemCardRatingModel } from './list-item-card-model';
import { Avatar } from '@components/avatar/avatar';
import { UserShareIncomingApiModel } from '@shared/models/api-model';

@Component({
  selector: 'ct-list-item-card',
  imports: [Avatar],
  templateUrl: './list-item-card.html',
  styleUrl: './list-item-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListItemCard {
  public readonly imageUrl = input('');
  public readonly title = input.required<string>();
  public readonly meta = input<string | null>(null);
  public readonly interactive = input(true);
  public readonly imageTestId = input('list-item-image');
  public readonly titleTestId = input('list-item-title');
  public readonly metaTestId = input<string | null>(null);
  public readonly completed = input(false);
  public readonly completedImage = input(false);
  public readonly completedLabel = input('');
  public readonly completedTestId = input('list-item-completed');
  public readonly imageBadgeText = input<string | null>(null);
  public readonly imageBadgeBackgroundColor = input<string | null>(null);
  public readonly imageBadgeTextColor = input<string | null>(null);
  public readonly imageBadgeDisabled = input(false);
  public readonly rating = input<ListItemCardRatingModel | null>(null);
  public readonly favorite = input(false);
  public readonly favoriteLabel = input('');
  public readonly shared = input(false);
  public readonly sharedLabel = input('');
  public readonly owner = input<UserShareIncomingApiModel | null>(null);
  protected readonly ownerLabel = computed(() => {
    const owner = this.owner();
    return owner
      ? `${this.sharedLabel()}: ${owner.ownerDisplayName || owner.ownerUsername || owner.ownerUserShareCode}`
      : this.sharedLabel();
  });
  public readonly open = output<void>();
  public readonly imageBadgeClick = output<void>();
  protected readonly failedImageUrl = signal<string | null>(null);

  protected onOpen(event?: Event): void {
    if (!this.interactive()) return;

    event?.preventDefault();
    this.open.emit();
  }

  protected onImageBadgeClick(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.imageBadgeClick.emit();
  }
}
