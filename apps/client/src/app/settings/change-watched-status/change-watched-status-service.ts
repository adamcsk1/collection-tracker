import { inject, Injectable } from '@angular/core';
import { CollectionService } from '@client/collection/collection-service';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { addNewTagToRawContent, removeTagFromRawContent } from '@services/parser/utils/manage-tags-util';
import { WATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Injectable()
export class ChangeWatchedStatusService {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collection = inject(CollectionService);
  private readonly api = inject(ApiService);
  private markAllAsWatchedHasFail = false;

  public markAllAsWatched(): void {
    this.confirm.ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllAsWatched')).subscribe(() => {
      this.blockerLoadingState.patchState('withoutDelay', true);
      this.blockerLoadingState.patchState('show', true);
      this.markAllAsWatchedHasFail = false;
      this.markAsWatchedNext(0);
    });
  }

  public markAllAsUnwatched(): void {
    this.confirm.ifConfirmed(this.ngxSignalTranslate.translate('Confirm.MarkAllAsUnwatched')).subscribe(() => {
      this.blockerLoadingState.patchState('withoutDelay', true);
      this.blockerLoadingState.patchState('show', true);
      this.markAsUnwatchedNext(0);
    });
  }

  private markAsWatchedNext(index: number): void {
    const collectionItems = this.mainCollectionState.state.collection();
    if (index >= collectionItems.length) {
      this.blockerLoadingState.patchState('show', false);

      if (this.markAllAsWatchedHasFail) {
        this.toastState.setState('timeout', 10000);
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkingAllAsWatchedWithErrors'));
      } else {
        this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkedAllAsWatched'));
      }

      this.collection.loadCollection();
      return;
    }

    this.blockerLoadingState.patchState(
      'message',
      this.ngxSignalTranslate.translate('Message.MarkingAllAsWatched', {
        count: `${collectionItems.length - index}`,
      }),
    );

    const item = collectionItems[index];
    if (item.tags.includes(WATCHED_TAG)) {
      this.markAsWatchedNext(index + 1);
      return;
    }

    const updatedRawContent = addNewTagToRawContent(item.rawContent, WATCHED_TAG);
    if (!updatedRawContent) {
      this.markAllAsWatchedHasFail = true;
      this.markAsWatchedNext(index + 1);
      return;
    }
    this.api.update(item.name, updatedRawContent, item.hash).subscribe(() => this.markAsWatchedNext(index + 1));
  }

  private markAsUnwatchedNext(index: number): void {
    const collectionItems = this.mainCollectionState.state.collection();
    if (index >= collectionItems.length) {
      this.blockerLoadingState.patchState('show', false);
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.MarkedAllAsUnwatched'));
      this.collection.loadCollection();
      return;
    }

    this.blockerLoadingState.patchState(
      'message',
      this.ngxSignalTranslate.translate('Message.MarkingAllAsUnwatched', {
        count: `${collectionItems.length - index}`,
      }),
    );

    const item = collectionItems[index];
    if (!item.tags.includes(WATCHED_TAG)) {
      this.markAsUnwatchedNext(index + 1);
      return;
    }

    const updatedRawContent = removeTagFromRawContent(item.rawContent, WATCHED_TAG);
    this.api.update(item.name, updatedRawContent, item.hash).subscribe(() => this.markAsUnwatchedNext(index + 1));
  }
}
