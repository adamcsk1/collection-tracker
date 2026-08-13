import { CollectionPage } from '../page-objects/collection.po';
import { ItemSharingDialog } from '../page-objects/item-sharing.po';
import { SettingsPage } from '../page-objects/settings.po';
import type { ApiEnvelope, OutgoingShareResponse, TestUser } from '../support/share-helper-model';
import {
  cleanupCreatedUsers,
  createUser,
  expectGrant,
  expectItemShare,
  expectNoGrant,
  getItemShares,
  grant,
  requestAs,
  saveItemShares,
  seedOwnerItem,
  setupShare,
  signInThroughUi,
  uniqueImdbId,
} from '../support/share-helpers';

const visitList = (user: TestUser, listType: 'library' | 'books' = 'library'): void => {
  signInThroughUi(user);
  cy.intercept('GET', '/api/v1/collection-items*').as('itemShareListLoad');
  if (listType === 'books') CollectionPage.visitBooks();
  else CollectionPage.visit();
  cy.wait('@itemShareListLoad');
};

const openItemShare = (title: string): void => {
  CollectionPage.getListItemByTitle(title).click();
  CollectionPage.getItemDialogShareButton().click();
  ItemSharingDialog.getDialog().should('be.visible');
};

const itemIdentity = (externalItemId: string, listType: 'library' | 'books' = 'library') => ({
  externalProvider: listType === 'books' ? 'openlibrary' : 'omdb',
  externalItemId,
  listType,
});

afterEach(() => {
  cleanupCreatedUsers();
});

describe('Individual item sharing - selection lifecycle', () => {
  it('creates first scope permissions, reuses them, and clears them after last removal', () => {
    setupShare([grant('wishlist', 'movie')], { prefix: 'isl' }).then(({ owner, sharedUser }) => {
      const firstId = uniqueImdbId();
      const secondId = uniqueImdbId();
      const firstTitle = 'Individually Shared First';
      const updatedFirstTitle = 'Individually Shared Updated';
      const secondTitle = 'Individually Shared Second';
      seedOwnerItem(owner, { title: firstTitle, externalId: firstId });
      seedOwnerItem(owner, { title: secondTitle, externalId: secondId });

      visitList(owner);
      openItemShare(firstTitle);
      ItemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).should('not.be.checked').check();
      ItemSharingDialog.getPermissions(sharedUser.shareCode).should('be.visible');
      ItemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-read').should('be.checked').and('be.disabled');
      ItemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-create').should('not.be.checked');
      ItemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-update').should('not.be.checked').check();
      ItemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-delete').should('not.be.checked');
      cy.intercept('PUT', '/api/v1/collection-items/*/*/shares*').as('saveFirstItemShare');
      ItemSharingDialog.getSaveButton().click();
      cy.wait('@saveFirstItemShare').its('response.statusCode').should('eq', 204);

      visitList(sharedUser);
      CollectionPage.getListItemByTitle(firstTitle).should('be.visible');
      CollectionPage.getListItemByTitle(secondTitle).should('not.exist');
      CollectionPage.getListItemByTitle(firstTitle).click();
      CollectionPage.getItemDialogShareButton().should('not.exist');
      CollectionPage.getItemDialogEditButton().click();
      CollectionPage.getItemDialogTitleInput().clear().type(updatedFirstTitle);
      CollectionPage.getItemDialogSaveButton().click();
      CollectionPage.getListItemByTitle(updatedFirstTitle).should('be.visible');

      visitList(owner);
      openItemShare(secondTitle);
      ItemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).check();
      ItemSharingDialog.getPermissions(sharedUser.shareCode).should('not.exist');
      ItemSharingDialog.getSaveButton().click();

      visitList(owner);
      openItemShare(updatedFirstTitle);
      ItemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).should('be.checked').uncheck();
      ItemSharingDialog.getSaveButton().click();

      visitList(sharedUser);
      CollectionPage.getListItemByTitle(updatedFirstTitle).should('not.exist');
      CollectionPage.getListItemByTitle(secondTitle).should('be.visible');

      visitList(owner);
      openItemShare(secondTitle);
      ItemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).should('be.checked').uncheck();
      ItemSharingDialog.getSaveButton().click();

      requestAs<ApiEnvelope<OutgoingShareResponse>>(owner, 'GET', '/api/v1/users/me/shares').then((response) => {
        const relationship = response.body.data.outgoing.find(
          (share) => share.sharedWithUserShareCode === sharedUser.shareCode
        );
        expect(relationship).to.exist;
        expectNoGrant(relationship!.grants, 'library', 'movie');
        expectGrant(relationship!.grants, 'wishlist', 'movie', { canRead: true });
      });
      getItemShares(owner, itemIdentity(secondId)).then((response) => {
        expectItemShare(response.body.data, sharedUser.shareCode, { readMode: 'none', permissions: null });
      });
      visitList(sharedUser);
      CollectionPage.getEmptyState().should('be.visible');
    });
  });
});

describe('Individual item sharing - scope transitions', () => {
  it('confirms selected scope promotion and clearing while preserving cancelled state', () => {
    setupShare([grant('wishlist', 'movie')], { prefix: 'ist' }).then(({ owner, sharedUser }) => {
      const selectedId = uniqueImdbId();
      const siblingId = uniqueImdbId();
      const selectedTitle = 'Tri-state Selected';
      const siblingTitle = 'Tri-state Sibling';
      seedOwnerItem(owner, { title: selectedTitle, externalId: selectedId });
      seedOwnerItem(owner, { title: siblingTitle, externalId: siblingId });
      saveItemShares(owner, itemIdentity(selectedId), [
        {
          sharedWithUserShareCode: sharedUser.shareCode,
          permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
        },
      ]);

      signInThroughUi(owner);
      const confirmationResults = [false, true, false, true];
      cy.on('window:confirm', () => confirmationResults.shift() ?? true);
      SettingsPage.visitShares();
      SettingsPage.getEditShareButton(sharedUser.shareCode).click({ scrollBehavior: 'center' });
      SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read')
        .should('have.prop', 'indeterminate', true)
        .check();
      SettingsPage.closeShareDialogByOverlay();
      SettingsPage.getEditShareButton(sharedUser.shareCode).click({ scrollBehavior: 'center' });
      SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read').should(
        'have.prop',
        'indeterminate',
        true
      );
      SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read').check();
      SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read')
        .should('be.checked')
        .and('have.prop', 'indeterminate', false);
      cy.intercept('POST', '/api/v1/users/me/shares').as('promoteSelectedScope');
      cy.intercept('GET', '/api/v1/users/me/shares').as('reloadPromotedScope');
      SettingsPage.getShareDialogSaveButton().click();
      cy.wait('@promoteSelectedScope').its('response.statusCode').should('eq', 204);
      cy.wait('@reloadPromotedScope').its('response.statusCode').should('eq', 200);

      visitList(sharedUser);
      CollectionPage.getListItemByTitle(selectedTitle).should('be.visible');
      CollectionPage.getListItemByTitle(siblingTitle).should('be.visible');

      signInThroughUi(owner);
      SettingsPage.visitShares();
      SettingsPage.getEditShareButton(sharedUser.shareCode).click({ scrollBehavior: 'center' });
      SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read').uncheck();
      cy.intercept('POST', '/api/v1/users/me/shares').as('clearSharedScope');
      cy.intercept('GET', '/api/v1/users/me/shares').as('reloadClearedScope');
      SettingsPage.getShareDialogSaveButton().click();
      cy.wait('@clearSharedScope').its('response.statusCode').should('eq', 204);
      cy.wait('@reloadClearedScope').its('response.statusCode').should('eq', 200);
      visitList(owner);
      openItemShare(selectedTitle);
      ItemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).check();
      cy.intercept('PUT', '/api/v1/collection-items/*/*/shares*').as('restoreSelectedScope');
      ItemSharingDialog.getSaveButton().click();
      cy.wait('@restoreSelectedScope').its('response.statusCode').should('eq', 204);
      cy.get('body').find('[data-test-id=item-share-dialog]').should('not.exist');
      CollectionPage.closeActiveDialogByOverlay();
      cy.get('body').find('[data-test-id=item-dialog]').should('not.exist');

      SettingsPage.visitShares();
      SettingsPage.getEditShareButton(sharedUser.shareCode).click({ scrollBehavior: 'center' });
      SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read').should(
        'have.prop',
        'indeterminate',
        true
      );
      SettingsPage.getClearSelectedShareButton('library', 'movie').click();
      SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read').should(
        'have.prop',
        'indeterminate',
        true
      );
      SettingsPage.getClearSelectedShareButton('library', 'movie').click();
      SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read')
        .should('not.be.checked')
        .and('have.prop', 'indeterminate', false);
      SettingsPage.getShareDialogSaveButton().click();

      visitList(sharedUser);
      CollectionPage.getEmptyState().should('be.visible');
      getItemShares(owner, itemIdentity(selectedId)).then((response) => {
        expectItemShare(response.body.data, sharedUser.shareCode, { readMode: 'none', permissions: null });
      });
    });
  });
});

describe('Individual item sharing - selected create', () => {
  it('auto-selects an item created in owner scope only for its creator', () => {
    setupShare([grant('wishlist', 'movie')], { prefix: 'isc' }).then(({ owner, sharedUser }) => {
      createUser('other', 'isc').then((otherUser) => {
        requestAs(owner, 'POST', '/api/v1/users/me/shares', {
          sharedWithUserShareCode: otherUser.shareCode,
          grants: [grant('wishlist', 'movie')],
        })
          .its('status')
          .should('eq', 204);
        const anchorId = uniqueImdbId();
        const createdId = uniqueImdbId();
        const anchorTitle = 'Selected Create Anchor';
        const createdTitle = 'Selected Create Result';
        seedOwnerItem(owner, { title: anchorTitle, externalId: anchorId });
        saveItemShares(owner, itemIdentity(anchorId), [
          {
            sharedWithUserShareCode: sharedUser.shareCode,
            permissions: { canRead: true, canCreate: true, canUpdate: false, canDelete: false },
          },
        ]);

        visitList(sharedUser);
        CollectionPage.getListItemByTitle(anchorTitle).should('be.visible');
        CollectionPage.getShowFunctionsButton().click();
        CollectionPage.getAddNewButton().click();
        CollectionPage.getNewItemManualModeButton().click();
        CollectionPage.getNewItemLibrarySelect().select(owner.shareCode);
        CollectionPage.getNewItemManualTitleInput().type(createdTitle);
        CollectionPage.getNewItemManualImdbIdInput().type(createdId);
        cy.intercept('POST', '/api/v1/collection-items').as('createSelectedItem');
        CollectionPage.getNewItemSaveAndCloseButton().should('be.enabled').click();
        cy.wait('@createSelectedItem').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(200);
          expect(request.body.targetOwnerShareCode).to.eq(owner.shareCode);
        });
        CollectionPage.getListItemByTitle(createdTitle).should('be.visible');
        getItemShares(owner, itemIdentity(createdId)).then((response) => {
          expectItemShare(response.body.data, sharedUser.shareCode, {
            readMode: 'selected',
            permissions: { canCreate: true },
          });
          expectItemShare(response.body.data, otherUser.shareCode, { readMode: 'none', permissions: null });
        });

        visitList(otherUser);
        CollectionPage.getEmptyState().should('be.visible');
      });
    });
  });
});

describe('Individual item sharing - physical scope routing', () => {
  it('shares only selected physical book rows through books scope', () => {
    setupShare([grant('wishlist', 'movie')], { prefix: 'isb' }).then(({ owner, sharedUser }) => {
      const selectedTitle = 'Selected Physical Book';
      const siblingTitle = 'Private Physical Book';
      const selectedIsbn = '9780306406157';
      seedOwnerItem(owner, { title: selectedTitle, contentType: 'book', externalId: selectedIsbn });
      seedOwnerItem(owner, { title: siblingTitle, contentType: 'book', externalId: '9780140328721' });

      visitList(owner, 'books');
      openItemShare(selectedTitle);
      ItemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).check();
      cy.intercept('PUT', '/api/v1/collection-items/*/*/shares*').as('saveBookShare');
      ItemSharingDialog.getSaveButton().click();
      cy.wait('@saveBookShare').then(({ request, response }) => {
        expect(response?.statusCode).to.eq(204);
        expect(request.url).to.include('/openlibrary/9780306406157/shares');
        expect(request.url).to.include('listType=books');
      });

      visitList(sharedUser, 'books');
      CollectionPage.getListItemByTitle(selectedTitle).should('be.visible');
      CollectionPage.getListItemByTitle(siblingTitle).should('not.exist');
      visitList(sharedUser);
      CollectionPage.getListItemByTitle(selectedTitle).should('be.visible');
      CollectionPage.getListItemByTitle(siblingTitle).should('not.exist');
    });
  });
});
