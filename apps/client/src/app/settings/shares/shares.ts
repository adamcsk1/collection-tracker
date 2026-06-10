import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { Checkbox } from '@components/checkbox/checkbox';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { toastStateToken } from '@components/toast/toast-store';
import { ConfirmService } from '@services/confirm-service';
import { UserShareOutgoingApiModel } from '@shared/models/api-model';
import { SelectDataModel } from '@shared/models/select-model';
import { copyToClipboard } from '@shared/utils/copy-to-clipboard-util';
import { mobileUserAgent } from '@shared/utils/mobile-user-agent.util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { mainStateToken } from '../../main/main-store';
import { SharesService } from '../../shares/shares-service';
import { sharesStateToken } from '../../shares/shares-store';
import { SettingsService } from '../settings-service';

@Component({
  selector: 'ct-settings-shares',
  imports: [FormField, FormRoot, Input, Checkbox, Select],
  templateUrl: './shares.html',
  styleUrl: './shares.css',
  providers: [SharesService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShares implements OnInit {
  private readonly mainState = inject(mainStateToken);
  private readonly sharesState = inject(sharesStateToken);
  private readonly sharesService = inject(SharesService);
  private readonly settings = inject(SettingsService);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly toastState = inject(toastStateToken);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly translations = {
    messageShareSettings: computed(() => this.ngxSignalTranslate.translate('Message.ShareSettings')),
    titleShareManagement: computed(() => this.ngxSignalTranslate.translate('Title.ShareManagement')),
    yourUserHash: computed(() => this.ngxSignalTranslate.translate('YourShareCode')),
    copy: computed(() => this.ngxSignalTranslate.translate('Copy')),
    outgoingShares: computed(() => this.ngxSignalTranslate.translate('OutgoingShares')),
    incomingShares: computed(() => this.ngxSignalTranslate.translate('IncomingShares')),
    defaultLibrary: computed(() => this.ngxSignalTranslate.translate('DefaultLibrary')),
    messageDefaultLibrary: computed(() => this.ngxSignalTranslate.translate('Message.DefaultLibrary')),
    shareCode: computed(() => this.ngxSignalTranslate.translate('ShareCode')),
    sharedWith: computed(() => this.ngxSignalTranslate.translate('SharedWith')),
    owner: computed(() => this.ngxSignalTranslate.translate('Owner')),
    canRead: computed(() => this.ngxSignalTranslate.translate('CanRead')),
    canCreate: computed(() => this.ngxSignalTranslate.translate('CanCreate')),
    canUpdate: computed(() => this.ngxSignalTranslate.translate('CanUpdate')),
    canDelete: computed(() => this.ngxSignalTranslate.translate('CanDelete')),
    addShare: computed(() => this.ngxSignalTranslate.translate('AddShare')),
    removeShare: computed(() => this.ngxSignalTranslate.translate('RemoveShare')),
    revokeShare: computed(() => this.ngxSignalTranslate.translate('RevokeShare')),
    validationRequired: computed(() => this.ngxSignalTranslate.translate('Validation.Required')),
    confirmRemoveShare: computed(() => this.ngxSignalTranslate.translate('Confirm.RemoveShare')),
    confirmRevokeShare: computed(() => this.ngxSignalTranslate.translate('Confirm.RevokeShare')),
    messageEmptyIncomingShares: computed(() => this.ngxSignalTranslate.translate('Message.EmptyIncomingShares')),
    messageEmptyOutgoingShares: computed(() => this.ngxSignalTranslate.translate('Message.EmptyOutgoingShares')),
  };
  protected readonly userShareCode = this.sharesState.state.userShareCode;
  protected readonly outgoing = this.sharesState.state.outgoing;
  protected readonly incoming = this.sharesState.state.incoming;
  protected readonly defaultLibraryOwnerShareCode = this.mainState.state.defaultLibraryOwnerShareCode;
  protected readonly defaultLibraryOptions = computed(() => [
    { text: this.ngxSignalTranslate.translate('MyLibrary'), value: '' },
    ...this.incoming()
      .filter((share) => share.canCreate)
      .map((share) => ({
        text: `${this.ngxSignalTranslate.translate('SharedLibrary')} (${share.ownerUsername ?? share.ownerUserShareCode})`,
        value: share.ownerUserShareCode,
      })),
  ]);
  protected readonly addShareModel = signal({
    sharedWithUserShareCode: '',
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  protected readonly form = form(
    this.addShareModel,
    (model) => {
      required(model.sharedWithUserShareCode);
    },
    {
      submission: {
        action: async () => this.onAddShare(),
      },
    }
  );

  public ngOnInit(): void {
    this.sharesService.loadShares();
  }

  protected onCopyUserHash(): void {
    copyToClipboard(this.userShareCode());
    if (!mobileUserAgent()) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.CopiedToClipboard'));
    }
  }

  protected onUpdateShare(share: UserShareOutgoingApiModel, permissions: Partial<UserShareOutgoingApiModel>): void {
    this.sharesService.saveShare(share.sharedWithUserShareCode, {
      canRead: permissions.canRead ?? share.canRead,
      canCreate: permissions.canCreate ?? share.canCreate,
      canUpdate: permissions.canUpdate ?? share.canUpdate,
      canDelete: permissions.canDelete ?? share.canDelete,
    });
  }

  protected onRemoveShare(sharedWithUserShareCode: string): void {
    this.confirm
      .ifConfirmed(this.translations.confirmRemoveShare())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.sharesService.removeShare(sharedWithUserShareCode));
  }

  protected onRevokeIncomingShare(ownerUserShareCode: string): void {
    this.confirm
      .ifConfirmed(this.translations.confirmRevokeShare())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.sharesService.revokeIncomingShare(ownerUserShareCode));
  }

  protected onDefaultLibraryChange(selectedValue: SelectDataModel['value']): void {
    this.settings.storeDefaultLibraryOwnerShareCode(
      typeof selectedValue === 'string' && selectedValue ? selectedValue : null
    );
  }

  private onAddShare(): void {
    const model = this.addShareModel();
    this.sharesService.saveShare(model.sharedWithUserShareCode.trim(), {
      canRead: model.canRead,
      canCreate: model.canCreate,
      canUpdate: model.canUpdate,
      canDelete: model.canDelete,
    });
    this.form().reset({
      sharedWithUserShareCode: '',
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    });
  }
}
