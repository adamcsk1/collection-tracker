import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Callout } from '@components/callout/callout';
import { Checkbox } from '@components/checkbox/checkbox';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import {
  CollectionItemShareApiModel,
  CollectionItemShareSelectionApiModel,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { finalize } from 'rxjs';
import { CollectionService } from '../../collection-service';
import { SharesLoaderService } from '../../../shares/shares-loader-service';
import { sharesStateToken } from '../../../shares/shares-store';
import type { ItemShareDraft, PermissionKey } from './item-share-dialog-model';

@Component({
  selector: 'ct-item-share-dialog',
  imports: [Callout, Checkbox, DialogShell, RevealLabel],
  providers: [SharesLoaderService],
  templateUrl: './item-share-dialog.html',
  styleUrl: './item-share-dialog.css',
  host: { class: 'dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemShareDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly collectionService = inject(CollectionService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);
  private readonly sharesLoader = inject(SharesLoaderService);
  private readonly sharesState = inject(sharesStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly previouslyFocusedElement =
    this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;

  public readonly externalProvider = input.required<string>();
  public readonly externalItemId = input.required<string>();
  public readonly listType = input.required<CollectionListTypeModel>();
  public readonly itemTitle = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saveError = signal(false);
  protected readonly recipients = signal<ItemShareDraft[]>([]);
  protected readonly translations = {
    canCreate: computed(() => this.ngxSignalTranslate.translate('CanCreate')),
    canDelete: computed(() => this.ngxSignalTranslate.translate('CanDelete')),
    canRead: computed(() => this.ngxSignalTranslate.translate('CanRead')),
    canUpdate: computed(() => this.ngxSignalTranslate.translate('CanUpdate')),
    empty: computed(() => this.ngxSignalTranslate.translate('Message.EmptyItemShareRecipients')),
    loadError: computed(() => this.ngxSignalTranslate.translate('Message.ItemSharesLoadError')),
    loading: computed(() => this.ngxSignalTranslate.translate('Message.Loading')),
    broad: computed(() => this.ngxSignalTranslate.translate('Message.ItemShareBroadAccess')),
    permissions: computed(() => this.ngxSignalTranslate.translate('Permissions')),
    readRequired: computed(() => this.ngxSignalTranslate.translate('Message.ItemShareReadRequired')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    saveError: computed(() => this.ngxSignalTranslate.translate('Message.ItemSharesSaveError')),
    settings: computed(() => this.ngxSignalTranslate.translate('OpenSharingSettings')),
    title: computed(() => this.ngxSignalTranslate.translate('Title.ShareItem', { name: this.itemTitle() })),
  };

  public ngOnInit(): void {
    this.loadShares();
  }

  private loadShares(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .getCollectionItemShares(this.externalProvider(), this.externalItemId(), this.listType())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (shares) => this.setCanonicalShares(shares),
        error: () => this.loadError.set(true),
      });
  }

  private setCanonicalShares(shares: CollectionItemShareApiModel[]): void {
    this.recipients.set(
      shares.map((share) => ({
        ...share,
        permissions: share.permissions ? { ...share.permissions } : null,
        permissionSetupRequired: false,
        selected: share.readMode === 'all' || share.readMode === 'selected',
      }))
    );
  }

  protected onRecipientToggle(recipientCode: string, selected: boolean): void {
    this.saveError.set(false);
    this.recipients.update((recipients) =>
      recipients.map((recipient) => {
        if (recipient.sharedWithUserShareCode !== recipientCode || recipient.readMode === 'all') return recipient;
        if (!selected) {
          return recipient.permissionSetupRequired
            ? { ...recipient, permissionSetupRequired: false, permissions: null, selected: false }
            : { ...recipient, selected: false };
        }
        if (recipient.permissions) return { ...recipient, selected: true };
        return {
          ...recipient,
          permissionSetupRequired: true,
          selected: true,
          permissions: {
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
          },
        };
      })
    );
  }

  protected onPermissionToggle(recipientCode: string, permission: PermissionKey, enabled: boolean): void {
    this.recipients.update((recipients) =>
      recipients.map((recipient) =>
        recipient.sharedWithUserShareCode === recipientCode && recipient.permissions
          ? { ...recipient, permissions: { ...recipient.permissions, [permission]: enabled } }
          : recipient
      )
    );
  }

  protected onSave(): void {
    if (this.saving() || this.loading() || this.loadError()) return;
    const selections = this.recipients().flatMap((recipient): CollectionItemShareSelectionApiModel[] => {
      if (recipient.readMode === 'all' || !recipient.selected || !recipient.permissions) return [];
      return [
        {
          sharedWithUserShareCode: recipient.sharedWithUserShareCode,
          ...(recipient.permissionSetupRequired ? { permissions: { ...recipient.permissions, canRead: true } } : {}),
        },
      ];
    });

    this.saving.set(true);
    this.saveError.set(false);
    this.api
      .saveCollectionItemShares(this.externalProvider(), this.externalItemId(), this.listType(), selections)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.sharesState.setState('loaded', false);
          this.sharesLoader.load(this.destroyRef);
          this.collectionService.triggerReload();
          this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.ItemSharesSaved'));
          this.portal.closeTop();
          this.previouslyFocusedElement?.focus();
        },
        error: () => this.saveError.set(true),
      });
  }

  protected onOpenSharingSettings(): void {
    this.portal.closeAll();
    void this.router.navigate(['/settings', 'shares']);
  }
}
