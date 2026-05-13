import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { Checkbox } from '@components/checkbox/checkbox';
import { Input } from '@components/input/input';
import { ConfirmService } from '@services/confirm-service';
import { UserShareOutgoingApiModel } from '@shared/models/api-model';
import { copyToClipboard } from '@shared/utils/copy-to-clipboard-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { SharesService } from '../../shares/shares-service';
import { sharesStateToken } from '../../shares/shares-store';

@Component({
  selector: 'ct-settings-shares',
  imports: [FormField, FormRoot, Input, Checkbox],
  templateUrl: './shares.html',
  styleUrl: './shares.css',
  providers: [SharesService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShares implements OnInit {
  private readonly sharesState = inject(sharesStateToken);
  private readonly sharesService = inject(SharesService);
  private readonly confirm = inject(ConfirmService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    messageShareSettings: computed(() => this.ngxSignalTranslate.translate('Message.ShareSettings')),
    titleShareManagement: computed(() => this.ngxSignalTranslate.translate('Title.ShareManagement')),
    yourUserHash: computed(() => this.ngxSignalTranslate.translate('YourShareCode')),
    copy: computed(() => this.ngxSignalTranslate.translate('Copy')),
    outgoingShares: computed(() => this.ngxSignalTranslate.translate('OutgoingShares')),
    incomingShares: computed(() => this.ngxSignalTranslate.translate('IncomingShares')),
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
    toastCopied: computed(() => this.ngxSignalTranslate.translate('Toast.Copied')),
    confirmRemoveShare: computed(() => this.ngxSignalTranslate.translate('Confirm.RemoveShare')),
    confirmRevokeShare: computed(() => this.ngxSignalTranslate.translate('Confirm.RevokeShare')),
    messageEmptyIncomingShares: computed(() => this.ngxSignalTranslate.translate('Message.EmptyIncomingShares')),
    messageEmptyOutgoingShares: computed(() => this.ngxSignalTranslate.translate('Message.EmptyOutgoingShares')),
  };
  protected readonly userShareCode = this.sharesState.state.userShareCode;
  protected readonly outgoing = this.sharesState.state.outgoing;
  protected readonly incoming = this.sharesState.state.incoming;
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
      .subscribe(() => this.sharesService.removeShare(sharedWithUserShareCode));
  }

  protected onRevokeIncomingShare(ownerUserShareCode: string): void {
    this.confirm
      .ifConfirmed(this.translations.confirmRevokeShare())
      .subscribe(() => this.sharesService.revokeIncomingShare(ownerUserShareCode));
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
