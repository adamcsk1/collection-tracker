import { inject, Injectable, signal } from '@angular/core';
import { blockerLoadingStateToken } from '@components/blocker-loading/blocker-loading-store';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { finalize, take, tap } from 'rxjs';
import { CollectionService } from '../../../collection/collection-service';
import { ExternalRatingsRefreshStateModel } from './external-ratings-refresh-model';

@Injectable()
export class ExternalRatingsRefreshService {
  private readonly blockerLoadingState = inject(blockerLoadingStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly api = inject(ApiService);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly collection = inject(CollectionService);
  private readonly _state = signal<ExternalRatingsRefreshStateModel>({
    running: false,
    completed: false,
    count: 0,
    checked: 0,
    fixed: 0,
    errors: 0,
  });
  public readonly state = this._state.asReadonly();

  public refreshExternalRatings(ownerShareCode?: string): void {
    this.confirm.ifConfirmed(this.ngxSignalTranslate.translate('Confirm.ExternalRatingsRefresh')).subscribe(() => {
      this.blockerLoadingState.patchState('withoutDelay', true);
      this.blockerLoadingState.patchState('show', true);
      this.blockerLoadingState.patchState(
        'message',
        this.ngxSignalTranslate.translate('Message.RefreshExternalRatings')
      );

      this._state.set({
        running: true,
        completed: false,
        count: 0,
        checked: 0,
        fixed: 0,
        errors: 0,
      });

      this.api
        .refreshExternalRatings(ownerShareCode)
        .pipe(
          take(1),
          tap((response) => {
            this._state.set({
              running: false,
              completed: true,
              count: response.count,
              checked: response.checked,
              fixed: response.fixed,
              errors: response.errors,
            });

            if (response.errors > 0) {
              this.toastState.setState('timeout', 10000);
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.ExternalRatingsRefreshedWithErrors')
              );
            } else {
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ExternalRatingsRefreshed'));
            }
            this.collection.triggerReload();
          }),
          finalize(() => {
            this._state.update((state) => ({ ...state, running: false }));
            this.blockerLoadingState.patchState('show', false);
          })
        )
        .subscribe({ error: () => undefined });
    });
  }
}
