import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { take, tap } from 'rxjs';
import { CollectionService } from '../../../collection/collection-service';
import { ImageRefreshStateModel } from './image-refresh-model';

@Injectable()
export class ImageRefreshService {
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly api = inject(ApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collection = inject(CollectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _state = signal<ImageRefreshStateModel>({
    running: false,
    completed: false,
    count: 0,
    checked: 0,
    fixed: 0,
    errors: 0,
  });
  public readonly state = this._state.asReadonly();

  public refreshImages(ownerShareCode?: string): void {
    this.confirm
      .ifConfirmed(this.ngxSignalTranslate.translate('Confirm.ImageRefresh'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.blockerLoadingState.patchState('withoutDelay', true);
        this.blockerLoadingState.patchState('show', true);
        this.blockerLoadingState.patchState('message', this.ngxSignalTranslate.translate('Message.RefreshImages'));

        this._state.set({
          running: true,
          completed: false,
          count: 0,
          checked: 0,
          fixed: 0,
          errors: 0,
        });

        this.api
          .refreshImages(ownerShareCode)
          .pipe(
            take(1),
            takeUntilDestroyed(this.destroyRef),
            tap((response) => {
              this._state.set({
                running: false,
                completed: true,
                count: response.count,
                checked: response.checked,
                fixed: response.fixed,
                errors: response.errors,
              });
              this.blockerLoadingState.patchState('show', false);

              if (response.errors > 0) {
                this.toastState.setState('timeout', 10000);
                this.toastState.setState(
                  'message',
                  this.ngxSignalTranslate.translate('Toast.ImagesRegeneratedWithErrors')
                );
              } else {
                this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ImagesRegenerated'));
              }
              this.collection.triggerReload();
            })
          )
          .subscribe();
      });
  }
}
