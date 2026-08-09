import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { Checkbox } from '@components/checkbox/checkbox';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Input } from '@components/input/input';
import { RevealLabel } from '@components/reveal-label/reveal-label';
import { PortalService } from '@services/portal-service';
import {
  CollectionItemContentTypeModel,
  CollectionListTypeModel,
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
  imports: [Checkbox, DialogShell, FormField, Input, RevealLabel],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.css',
  host: { class: 'dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  public readonly share = input<UserShareOutgoingApiModel | UserShareIncomingApiModel>();
  public readonly saved = input<(sharedWithUserShareCode: string, grants: UserShareGrantApiModel[]) => void>(
    () => undefined
  );
  protected readonly shareableScopes = SHAREABLE_SCOPES;
  protected readonly listTypes = [...new Set(SHAREABLE_SCOPES.map((scope) => scope.listType))];
  protected readonly shareCodeModel = signal({ sharedWithUserShareCode: '' });
  protected readonly form = form(this.shareCodeModel, (model) => required(model.sharedWithUserShareCode));
  protected readonly grants = signal<UserShareGrantApiModel[]>([]);
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
  protected readonly valid = computed(
    () => !this.readOnly() && this.grants().length > 0 && (this.editing() || !this.form().invalid())
  );
  protected readonly translations = {
    addTitle: computed(() => this.ngxSignalTranslate.translate('AddShare')),
    editTitle: computed(() => this.ngxSignalTranslate.translate('EditShare')),
    detailsTitle: computed(() => this.ngxSignalTranslate.translate('ShareDetails')),
    sharedWith: computed(() => this.ngxSignalTranslate.translate('SharedWith')),
    message: computed(() => this.ngxSignalTranslate.translate('Message.ShareGrants')),
    save: computed(() => this.ngxSignalTranslate.translate('Save')),
    canRead: computed(() => this.ngxSignalTranslate.translate('CanRead')),
    canCreate: computed(() => this.ngxSignalTranslate.translate('CanCreate')),
    canUpdate: computed(() => this.ngxSignalTranslate.translate('CanUpdate')),
    canDelete: computed(() => this.ngxSignalTranslate.translate('CanDelete')),
  };

  public ngOnInit(): void {
    const share = this.share();
    this.grants.set(share ? normalizeShareGrants(share.grants) : defaultLibraryReadGrants());
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
    const permissionMap = { canRead: 'read', canCreate: 'create', canUpdate: 'update', canDelete: 'delete' } as const;
    return hasSharePermission(this.grants(), listType, contentType, permissionMap[permission]);
  }

  protected onGrantToggle(
    listType: CollectionListTypeModel,
    contentType: CollectionItemContentTypeModel,
    permission: GrantPermissionKey,
    enabled: boolean
  ): void {
    this.grants.update((grants) => {
      const existing = grants.find((grant) => grant.listType === listType && grant.contentType === contentType);
      const nextGrant: UserShareGrantApiModel = {
        listType,
        contentType,
        canRead: existing?.canRead ?? false,
        canCreate: existing?.canCreate ?? false,
        canUpdate: existing?.canUpdate ?? false,
        canDelete: existing?.canDelete ?? false,
        [permission]: enabled,
      };
      if (permission !== 'canRead' && enabled) nextGrant.canRead = true;
      const withoutScope = grants.filter(
        (grant) => !(grant.listType === listType && grant.contentType === contentType)
      );
      return normalizeShareGrants([...withoutScope, nextGrant]);
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
  }
}
