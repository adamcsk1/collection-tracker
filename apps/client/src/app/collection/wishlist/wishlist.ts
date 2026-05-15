import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { CollectionListDataSourceRequest } from '../collection-model';
import { List } from '../list/list';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';

@Component({
  selector: 'ct-wishlist',
  imports: [List],
  templateUrl: './wishlist.html',
  styleUrl: '../collection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Wishlist {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly api = inject(ApiService);

  protected readonly wishlistDataSource = ({ offset, limit }: CollectionListDataSourceRequest) =>
    this.api.searchItems({ listType: 'wishlist' }, offset, limit);
  protected readonly translations = {
    messageEmptyWishlist: computed(() => this.ngxSignalTranslate.translate('Message.EmptyWishlist')),
    messageAddFirstWishlist: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstWishlist')),
  };

  protected onAddWishlist(event: Event): void {
    event.preventDefault();
    this.portal.open(NewItemDialog, { wishlist: true });
  }
}
