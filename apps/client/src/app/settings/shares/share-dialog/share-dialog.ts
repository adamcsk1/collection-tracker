import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  Signal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, required } from '@angular/forms/signals';
import { Callout } from '@components/callout/callout';
import { Checkbox } from '@components/checkbox/checkbox';
import { Details } from '@components/details/details';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { PortalService } from '@services/portal-service';
import { ConfirmService } from '@services/confirm-service';
import {
  CollectionItemContentTypeModel,
  CollectionListTypeModel,
  CollectionOwnerDefaultModel,
  UserShareGrantApiModel,
  UserShareIncomingApiModel,
  UserShareOutgoingApiModel,
} from '@shared/models/api-model';
import {
  defaultLibraryReadGrants,
  hasSharePermission,
  normalizeShareGrants,
  SHAREABLE_SCOPES,
} from '@shared/utils/share-grant-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

type GrantPermissionKey = 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete';

@Component({
  selector: 'ct-share-dialog',
  imports: [Callout, Checkbox, Details, DialogShell, FormField, Input, RevealLabel],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.css',
  host: { class: 'dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly confirm = inject(ConfirmService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly previouslyFocusedElement =
    this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
  public readonly share = input<UserShareOutgoingApiModel | UserShareIncomingApiModel>();
  public readonly saved = input<(sharedWithUserShareCode: string, grants: UserShareGrantApiModel[]) => void>(
    () => undefined
  );
  public readonly defaultCollectionOwners = input<Signal<CollectionOwnerDefaultModel[]>>(signal([]));
  public readonly defaultsChanged = input<(defaults: CollectionOwnerDefaultModel[]) => void>(() => undefined);
  protected readonly shareableScopes = SHAREABLE_SCOPES;
  protected readonly listTypes = [...new Set(SHAREABLE_SCOPES.map((scope) => scope.listType))];
  protected readonly shareCodeModel = signal({ sharedWithUserShareCode: '' });
  protected readonly form = form(this.shareCodeModel, (model) => required(model.sharedWithUserShareCode));
  protected readonly grants = signal<UserShareGrantApiModel[]>([]);
  protected readonly initialGrants = signal<UserShareGrantApiModel[]>([]);
  protected readonly permissionChangeAnnouncement = signal('');
  protected readonly editing = computed(() => this.share() !== undefined);
  protected readonly readOnly = computed(() => this.share() !== undefined && 'ownerUserShareCode' in this.share()!);
  protected readonly incomingShareName = computed(() => {
    const share = this.share();
    return share && 'ownerUserShareCode' in share ? share.ownerUsername || share.ownerUserShareCode : '';
  });
  protected readonly outgoingShareName = computed(() => {
    const share = this.share();
    return share && 'sharedWithUserShareCode' in share ? share.sharedWithUsername || share.sharedWithUserShareCode : '';
  });
  protected readonly dialogTitle = computed(() => {
    if (this.readOnly()) {
      return this.ngxSignalTranslate.translate('Title.IncomingShareAccess', { name: this.incomingShareName() });
    }
    if (this.editing()) {
      return this.ngxSignalTranslate.translate('Title.EditShareAccess', { name: this.outgoingShareName() });
    }
    return this.ngxSignalTranslate.translate('AddShare');
  });
  protected readonly grantsMessage = computed(() => {
    if (this.readOnly()) {
      return this.ngxSignalTranslate.translate('Message.IncomingShareGrants', { name: this.incomingShareName() });
    }
    if (this.editing()) {
      return this.ngxSignalTranslate.translate('Message.OutgoingShareGrants', { name: this.outgoingShareName() });
    }
    return this.ngxSignalTranslate.translate('Message.NewShareGrants');
  });
  protected readonly valid = computed(() => !this.readOnly() && (this.editing() || !this.form().invalid()));
  protected readonly translations = {
    recipientShareCode: computed(() => this.ngxSignalTranslate.translate('RecipientShareCode')),
    dependency: computed(() => this.ngxSignalTranslate.translate('Message.ShareGrantDependency')),
    permissions: computed(() => this.ngxSignalTranslate.translate('Permissions')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    canRead: computed(() => this.ngxSignalTranslate.translate('CanRead')),
    canCreate: computed(() => this.ngxSignalTranslate.translate('CanCreate')),
    canUpdate: computed(() => this.ngxSignalTranslate.translate('CanUpdate')),
    canDelete: computed(() => this.ngxSignalTranslate.translate('CanDelete')),
    canReadDescription: computed(() => this.ngxSignalTranslate.translate('Permission.ReadDescription')),
    canCreateDescription: computed(() => this.ngxSignalTranslate.translate('Permission.CreateDescription')),
    canUpdateDescription: computed(() => this.ngxSignalTranslate.translate('Permission.UpdateDescription')),
    canDeleteDescription: computed(() => this.ngxSignalTranslate.translate('Permission.DeleteDescription')),
    clearSelected: computed(() => this.ngxSignalTranslate.translate('ClearSelectedItemAccess')),
    defaultDestination: computed(() => this.ngxSignalTranslate.translate('DefaultDestination')),
    confirmSelectedToAll: computed(() => this.ngxSignalTranslate.translate('Confirm.ShareSelectedToAll')),
    confirmSelectedToNone: computed(() => this.ngxSignalTranslate.translate('Confirm.ShareSelectedToNone')),
  };

  public ngOnInit(): void {
    const share = this.share();
    const grants = share ? normalizeShareGrants(share.grants) : defaultLibraryReadGrants();
    this.initialGrants.set(grants);
    this.grants.set(grants);
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

  protected scopesForList(listType: CollectionListTypeModel) {
    return this.shareableScopes.filter((scope) => scope.listType === listType);
  }

  protected grantChecked(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel,
    permission: GrantPermissionKey
  ): boolean {
    if (permission === 'canRead') return this.readMode(listType, contentType) === 'all';
    const permissionMap = { canCreate: 'create', canUpdate: 'update', canDelete: 'delete' } as const;
    return hasSharePermission(this.grants(), listType, contentType, permissionMap[permission]);
  }

  protected canSetDefault(listType: CollectionListTypeModel, contentType: CollectionItemContentTypeModel): boolean {
    return this.readOnly() && hasSharePermission(this.grants(), listType, contentType, 'create');
  }

  protected defaultChecked(listType: CollectionListTypeModel, contentType: CollectionItemContentTypeModel): boolean {
    const share = this.share();
    if (!share || !('ownerUserShareCode' in share)) return false;
    return this.defaultCollectionOwners()().some(
      (entry) =>
        entry.listType === listType &&
        entry.contentType === contentType &&
        entry.ownerUserShareCode === share.ownerUserShareCode
    );
  }

  protected onDefaultToggle(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel,
    enabled: boolean
  ): void {
    const share = this.share();
    if (!share || !('ownerUserShareCode' in share) || !this.canSetDefault(listType, contentType)) return;
    const defaults = this.defaultCollectionOwners()().filter(
      (entry) => !(entry.listType === listType && entry.contentType === contentType)
    );
    if (enabled) {
      defaults.push({ listType, contentType, ownerUserShareCode: share.ownerUserShareCode });
    }
    this.defaultsChanged()(defaults);
  }

  protected readIndeterminate(listType: CollectionListTypeModel, contentType: CollectionItemContentTypeModel): boolean {
    return this.readMode(listType, contentType) === 'selected';
  }

  private readMode(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel
  ): 'none' | 'selected' | 'all' {
    const grant = this.grants().find((entry) => entry.listType === listType && entry.contentType === contentType);
    return grant?.readMode ?? 'none';
  }

  protected permissionChanged(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel,
    permission: GrantPermissionKey
  ): boolean {
    if (permission === 'canRead') {
      return this.readMode(listType, contentType) !== this.initialReadMode(listType, contentType);
    }
    const permissionMap = { canCreate: 'create', canUpdate: 'update', canDelete: 'delete' } as const;
    return (
      hasSharePermission(this.grants(), listType, contentType, permissionMap[permission]) !==
      hasSharePermission(this.initialGrants(), listType, contentType, permissionMap[permission])
    );
  }

  private initialReadMode(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel
  ): 'none' | 'selected' | 'all' {
    const grant = this.initialGrants().find(
      (entry) => entry.listType === listType && entry.contentType === contentType
    );
    return grant?.readMode ?? 'none';
  }

  protected onGrantToggle(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel,
    permission: GrantPermissionKey,
    enabled: boolean
  ): void {
    if (permission === 'canRead') {
      this.onReadToggle(listType, contentType, enabled);
      return;
    }
    this.permissionChangeAnnouncement.set('');
    this.grants.update((grants) => {
      const existing = grants.find((grant) => grant.listType === listType && grant.contentType === contentType);
      const nextGrant: UserShareGrantApiModel = {
        listType,
        contentType,
        canRead: existing?.canRead ?? false,
        canCreate: existing?.canCreate ?? false,
        canUpdate: existing?.canUpdate ?? false,
        canDelete: existing?.canDelete ?? false,
        readMode: existing?.readMode ?? 'all',
        [permission]: enabled,
      };
      if (enabled) {
        nextGrant.canRead = true;
        if (!(existing?.canRead ?? false)) {
          this.permissionChangeAnnouncement.set(
            this.ngxSignalTranslate.translate('Message.ShareGrantViewEnabled', {
              list: this.listTypeLabel(listType),
              content: this.contentTypeLabel(contentType),
            })
          );
        }
      }
      const withoutScope = grants.filter(
        (grant) => !(grant.listType === listType && grant.contentType === contentType)
      );
      return normalizeShareGrants([...withoutScope, nextGrant]);
    });
  }

  protected onReadToggle(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel,
    enabled: boolean
  ): void {
    const mode = this.readMode(listType, contentType);
    if (mode === 'selected' && enabled) {
      this.confirm
        .open(this.translations.confirmSelectedToAll())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((confirmed) => {
          if (confirmed) this.setReadMode(listType, contentType, 'all');
          else this.grants.set([...this.grants()]);
        });
      return;
    }
    this.setReadMode(listType, contentType, enabled ? 'all' : 'none');
  }

  protected onClearSelected(listType: CollectionListTypeModel, contentType: CollectionItemContentTypeModel): void {
    if (this.readMode(listType, contentType) !== 'selected') return;
    this.confirm
      .open(this.translations.confirmSelectedToNone())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) this.setReadMode(listType, contentType, 'none');
      });
  }

  private setReadMode(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel,
    mode: 'none' | 'all'
  ): void {
    this.permissionChangeAnnouncement.set('');
    this.grants.update((grants) => {
      const existing = grants.find((grant) => grant.listType === listType && grant.contentType === contentType);
      const withoutScope = grants.filter(
        (grant) => !(grant.listType === listType && grant.contentType === contentType)
      );
      if (mode === 'none') {
        if (existing?.canCreate || existing?.canUpdate || existing?.canDelete) {
          this.permissionChangeAnnouncement.set(
            this.ngxSignalTranslate.translate('Message.ShareGrantChildrenCleared', {
              list: this.listTypeLabel(listType),
              content: this.contentTypeLabel(contentType),
            })
          );
        }
        return withoutScope;
      }
      return normalizeShareGrants([
        ...withoutScope,
        {
          listType,
          contentType,
          canRead: true,
          canCreate: existing?.canCreate ?? false,
          canUpdate: existing?.canUpdate ?? false,
          canDelete: existing?.canDelete ?? false,
          readMode: 'all',
        },
      ]);
    });
  }

  protected onSave(): void {
    if (!this.valid()) return;
    const share = this.share();
    const shareCode =
      share && 'sharedWithUserShareCode' in share
        ? share.sharedWithUserShareCode
        : this.shareCodeModel().sharedWithUserShareCode;
    this.saved()(shareCode.trim(), this.grants());
    this.portal.closeTop();
    this.previouslyFocusedElement?.focus();
  }
}
