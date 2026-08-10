import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Select } from '@components/select/select';
import { toastStateToken } from '@components/toast/toast-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import {
  CollectionItemContentTypeModel,
  CollectionListTypeModel,
  UserShareGrantApiModel,
  UserShareIncomingApiModel,
  UserShareOutgoingApiModel,
} from '@shared/models/api-model';
import { SelectDataModel } from '@shared/models/select-model';
import { copyToClipboard } from '@shared/utils/copy-to-clipboard-util';
import { mobileUserAgent } from '@shared/utils/mobile-user-agent.util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { mainStateToken } from '../../main/main-store';
import { SharesService } from '../../shares/shares-service';
import { sharesStateToken } from '../../shares/shares-store';
import { SettingsService } from '../settings-service';
import { ShareDialog } from './share-dialog/share-dialog';

@Component({
  selector: 'ct-settings-shares',
  imports: [Select],
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
  private readonly portal = inject(PortalService);
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
    sharedWith: computed(() => this.ngxSignalTranslate.translate('SharedWith')),
    owner: computed(() => this.ngxSignalTranslate.translate('Owner')),
    canRead: computed(() => this.ngxSignalTranslate.translate('CanRead')),
    canCreate: computed(() => this.ngxSignalTranslate.translate('CanCreate')),
    canUpdate: computed(() => this.ngxSignalTranslate.translate('CanUpdate')),
    canDelete: computed(() => this.ngxSignalTranslate.translate('CanDelete')),
    addShare: computed(() => this.ngxSignalTranslate.translate('AddShare')),
    editShare: computed(() => this.ngxSignalTranslate.translate('EditShare')),
    viewShare: computed(() => this.ngxSignalTranslate.translate('ViewShare')),
    removeShare: computed(() => this.ngxSignalTranslate.translate('RemoveShare')),
    revokeShare: computed(() => this.ngxSignalTranslate.translate('RevokeShare')),
    confirmRemoveShare: computed(() => this.ngxSignalTranslate.translate('Confirm.RemoveShare')),
    confirmRevokeShare: computed(() => this.ngxSignalTranslate.translate('Confirm.RevokeShare')),
    messageEmptyIncomingShares: computed(() => this.ngxSignalTranslate.translate('Message.EmptyIncomingShares')),
    messageEmptyOutgoingShares: computed(() => this.ngxSignalTranslate.translate('Message.EmptyOutgoingShares')),
  };
  protected readonly userShareCode = this.sharesState.state.userShareCode;
  protected readonly outgoing = this.sharesState.state.outgoing;
  protected readonly incoming = this.sharesState.state.incoming;
  protected readonly mutating = this.sharesState.state.mutating;
  protected readonly defaultLibraryOwnerShareCode = this.mainState.state.defaultLibraryOwnerShareCode;
  protected readonly defaultLibraryOptions = computed(() => [
    { text: this.ngxSignalTranslate.translate('MyLibrary'), value: '' },
    ...this.incoming()
      .filter((share) => share.grants.some((grant) => grant.listType === 'library' && grant.canCreate))
      .map((share) => ({
        text: `${this.ngxSignalTranslate.translate('SharedLibrary')} (${share.ownerUsername ?? share.ownerUserShareCode})`,
        value: share.ownerUserShareCode,
      })),
  ]);

  public ngOnInit(): void {
    this.sharesService.loadShares();
  }

  protected listTypeLabel(listType: CollectionListTypeModel): string {
    const labels: Record<CollectionListTypeModel, string> = {
      library: 'Library',
      books: 'Books',
      wishlist: 'Wishlist',
      'up-next': 'UpNext',
      tracking: 'Tracking',
    };
    return this.ngxSignalTranslate.translate(labels[listType]);
  }

  protected contentTypeLabel(contentType: CollectionItemContentTypeModel): string {
    return this.ngxSignalTranslate.translate(
      contentType === 'movie' ? 'Movies' : contentType === 'series' ? 'Series' : 'Books'
    );
  }

  protected onAddShare(): void {
    this.portal.open(ShareDialog, {
      saved: (sharedWithUserShareCode: string, grants: UserShareGrantApiModel[]) =>
        this.sharesService.saveShare(sharedWithUserShareCode, grants),
    });
  }

  protected onEditShare(share: UserShareOutgoingApiModel): void {
    this.portal.open(ShareDialog, {
      share,
      saved: (_sharedWithUserShareCode: string, grants: UserShareGrantApiModel[]) =>
        this.sharesService.saveShare(share.sharedWithUserShareCode, grants),
    });
  }

  protected onViewIncomingShare(share: UserShareIncomingApiModel): void {
    this.portal.open(ShareDialog, { share });
  }

  protected onCopyUserHash(): void {
    copyToClipboard(this.userShareCode());
    if (!mobileUserAgent()) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.CopiedToClipboard'));
    }
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
}
