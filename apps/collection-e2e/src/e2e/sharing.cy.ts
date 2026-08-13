import { buildOmdbItem, buildOmdbSearchResult } from '../fixtures/omdb';
import { CollectionPage } from '../page-objects/collection.po';
import { SettingsPage } from '../page-objects/settings.po';
import type { CollectionPageEnvelope, ShareGrant } from '../support/share-helper-model';
import {
  cleanupCreatedUsers,
  createUser,
  expectGrant,
  expectNoGrant,
  grant,
  libraryMovieSeriesGrants,
  requestAs,
  seedOwnerItem,
  setupShare,
  signInThroughUi,
  uniqueImdbId,
} from '../support/share-helpers';

const visitSharedList = (
  sharedUser: Parameters<typeof signInThroughUi>[0],
  list: 'library' | 'wishlist' | 'tracking' | 'books' | 'up-next' = 'library'
): void => {
  signInThroughUi(sharedUser);
  cy.intercept('GET', '/api/v1/collection-items*').as('itemsLoad');
  switch (list) {
    case 'wishlist':
      CollectionPage.visitWishlist();
      break;
    case 'tracking':
      CollectionPage.visitTracking();
      break;
    case 'books':
      CollectionPage.visitBooks();
      break;
    case 'up-next':
      CollectionPage.visitUpNext();
      break;
    default:
      CollectionPage.visit();
  }
  cy.wait('@itemsLoad');
};

const assertDialogPermissions = (permissions: { update: boolean; delete: boolean }): void => {
  CollectionPage.expectItemDialogActionsVisible();

  if (permissions.update) {
    CollectionPage.getItemDialogEditButton().should('be.visible');
  } else {
    cy.getByTestId('item-dialog-edit').should('not.exist');
  }

  if (permissions.delete) {
    CollectionPage.getItemDialogDeleteButton().should('be.visible');
  } else {
    cy.getByTestId('item-dialog-delete').should('not.exist');
  }
};

const openFloatFilters = (): void => {
  CollectionPage.getShowFunctionsButton().click();
};

afterEach(() => {
  cleanupCreatedUsers();
});

describe('Collection sharing - settings management', () => {
  it('creates multi-scope grants, updates one scope, removes and revokes shares', () => {
    return createUser('owner').then((owner) =>
      createUser('shared').then((sharedUser) => {
        signInThroughUi(owner);
        SettingsPage.visitShares();

        SettingsPage.getShareCode().should('contain.text', owner.shareCode);
        SettingsPage.getAddShareOpenButton().click();
        SettingsPage.getShareDialog().should('be.visible');
        SettingsPage.getShareDialogDependency().should('exist');
        SettingsPage.getShareDialogUserHashInput().type(sharedUser.shareCode);

        // Default library movie/series View is on. A child permission enables View for an unread scope.
        SettingsPage.getAddShareGrantCheckbox('library', 'movie', 'can-create').check();
        SettingsPage.getAddShareGrantCheckbox('wishlist', 'movie', 'can-delete').check();
        SettingsPage.getAddShareGrantCheckbox('wishlist', 'movie', 'can-read').should('be.checked');

        cy.intercept('POST', '/api/v1/users/me/shares').as('saveShare');
        cy.intercept('GET', '/api/v1/users/me/shares').as('reloadShares');
        SettingsPage.getShareDialogSaveButton().click();
        cy.wait('@saveShare').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(204);
          const grants = request.body.grants as ShareGrant[];
          expect(grants).to.be.an('array');
          expectGrant(grants, 'library', 'movie', { canRead: true, canCreate: true });
          expectGrant(grants, 'library', 'series', { canRead: true, canCreate: false });
          expectGrant(grants, 'wishlist', 'movie', { canRead: true, canDelete: true });
          expectNoGrant(grants, 'wishlist', 'series');
        });
        cy.wait('@reloadShares').its('response.statusCode').should('eq', 200);

        SettingsPage.getEditShareButton(sharedUser.shareCode).click();
        SettingsPage.getShareDialog().should('be.visible');
        SettingsPage.getShareDialogTitle().should('contain.text', sharedUser.username);
        SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-create').should('be.checked');
        SettingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-read').should('be.checked');
        SettingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-delete').should('be.checked');
        SettingsPage.getOutgoingShareGrantCheckbox('library', 'series', 'can-create').should('not.be.checked');

        // Turning off parent View clears children. Enabling a child restores View.
        SettingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-read').uncheck();
        SettingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-delete').should('not.be.checked');
        SettingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-update').check();
        SettingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-read').should('be.checked');
        SettingsPage.getShareDialogSaveButton().click();
        cy.wait('@saveShare').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(204);
          const grants = request.body.grants as ShareGrant[];
          expectGrant(grants, 'wishlist', 'movie', { canRead: true, canUpdate: true });
          expectGrant(grants, 'library', 'movie', { canCreate: true });
        });
        cy.wait('@reloadShares').its('response.statusCode').should('eq', 200);
        SettingsPage.getEditShareButton(sharedUser.shareCode).click();
        SettingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-update').should('be.checked');
        SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-update').should('not.be.checked');
        cy.get('body').type('{esc}');

        cy.on('window:confirm', () => true);
        cy.intercept('DELETE', '/api/v1/users/me/shares/*').as('removeShare');
        SettingsPage.getRemoveShareButton(sharedUser.shareCode).click();
        cy.wait('@removeShare').its('response.statusCode').should('eq', 204);

        // Re-share for revoke path with multi-scope grants.
        requestAs(owner, 'POST', '/api/v1/users/me/shares', {
          sharedWithUserShareCode: sharedUser.shareCode,
          grants: [
            grant('library', 'movie', { canRead: true }),
            grant('wishlist', 'series', { canRead: true, canCreate: true }),
          ],
        })
          .its('status')
          .should('eq', 204);

        signInThroughUi(sharedUser);
        SettingsPage.visitShares();
        cy.contains(owner.username).should('exist');
        SettingsPage.getViewIncomingShareButton(owner.shareCode).click();
        SettingsPage.getShareDialog().should('be.visible');
        SettingsPage.getShareDialogTitle().should('contain.text', owner.username);
        SettingsPage.getShareDialogMessage().should('contain.text', 'Permissions are read only');
        SettingsPage.getShareDialogDependency().should('not.exist');
        SettingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read').should('be.checked');
        SettingsPage.getOutgoingShareGrantCheckbox('wishlist', 'series', 'can-create').should('be.checked');
        SettingsPage.getShareDialogSaveButton().should('not.exist');
        cy.get('body').type('{esc}');

        cy.intercept('DELETE', '/api/v1/users/me/shares/incoming/*').as('revokeShare');
        SettingsPage.getRevokeIncomingShareButton(owner.shareCode).click();
        cy.wait('@revokeShare').its('response.statusCode').should('eq', 204);
      })
    );
  });
});

describe('Collection sharing - library movie permissions', () => {
  it('shows read-only shared items without edit or delete actions', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: false })).then(
      ({ owner, sharedUser }) => {
        seedOwnerItem(owner, { title: 'Shared Read Movie', externalId: uniqueImdbId() });
        visitSharedList(sharedUser);

        CollectionPage.getListItems().should('contain.text', 'Shared Read Movie');
        CollectionPage.getSharedBadges().should('be.visible');
        CollectionPage.getListItemImages().first().click();
        CollectionPage.getItemDialogSharedLibraryBadge().should('contain.text', owner.username);
        assertDialogPermissions({ update: false, delete: false });
        // Mark watched remains available from library without update grant (personal twin).
        CollectionPage.getItemDialogMarkFinishedButton().should('be.visible');
      }
    );
  });

  it('allows adding a new item to a shared library with create permission', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: true, canUpdate: false, canDelete: false })).then(
      ({ owner, sharedUser }) => {
        const title = 'Shared Create Movie';
        const imdbId = uniqueImdbId();
        cy.intercept('GET', '/api/v1/external-metadata/search*', {
          statusCode: 200,
          body: { data: buildOmdbSearchResult(title, imdbId) },
        }).as('omdbSearch');
        cy.intercept('GET', '/api/v1/external-metadata/items*', {
          statusCode: 200,
          body: { data: buildOmdbItem(title, imdbId) },
        }).as('omdbItem');

        visitSharedList(sharedUser);
        CollectionPage.getShowFunctionsButton().click();
        CollectionPage.getAddNewButton().click();
        CollectionPage.getNewItemSearchInput().type(title);
        cy.wait('@omdbSearch');
        CollectionPage.getNewItemLibrarySelect().select(owner.shareCode);
        cy.intercept('POST', '/api/v1/collection-items').as('createItem');
        CollectionPage.getNewItemSaveAndCloseButton().click();
        cy.wait('@omdbItem');
        cy.wait('@createItem').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(200);
          expect(request.body.targetOwnerShareCode).to.eq(owner.shareCode);
          expect(request.body.contentType).to.eq('movie');
        });
        CollectionPage.getListItems().should('contain.text', title);
        CollectionPage.getSharedBadges().should('be.visible');

        // Owner still owns the row.
        requestAs<CollectionPageEnvelope<{ title: string; ownerShareCode?: string }>>(
          owner,
          'GET',
          '/api/v1/collection-items?listType=library&limit=50'
        ).then((response) => {
          expect(response.body.data.some((item) => item.title === title)).to.eq(true);
        });
      }
    );
  });

  it('adds a manual item to a shared library and persists it after reload', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: true, canUpdate: false, canDelete: false })).then(
      ({ owner, sharedUser }) => {
        const title = 'Shared Manual Movie';
        const imdbId = uniqueImdbId();
        visitSharedList(sharedUser);
        CollectionPage.getShowFunctionsButton().click();
        CollectionPage.getAddNewButton().click();
        CollectionPage.getNewItemManualModeButton().click();
        CollectionPage.getNewItemLibrarySelect().select(owner.shareCode);
        CollectionPage.getNewItemManualTitleInput().type(title);
        CollectionPage.getNewItemManualImdbIdInput().type(imdbId);

        cy.intercept('POST', '/api/v1/collection-items').as('createManualItem');
        CollectionPage.getNewItemSaveAndCloseButton().should('be.enabled').click();
        cy.wait('@createManualItem').then(({ request, response }) => {
          expect(request.body).to.deep.include({
            title,
            IMDbId: imdbId,
            externalProvider: 'omdb',
            externalItemId: imdbId,
            contentType: 'movie',
            targetOwnerShareCode: owner.shareCode,
          });
          expect(response?.statusCode).to.equal(200);
        });

        cy.intercept('GET', '/api/v1/collection-items*').as('manualItemsReload');
        cy.reload();
        cy.wait('@manualItemsReload');
        CollectionPage.getListItems().should('have.length', 1).and('contain.text', title);
        CollectionPage.getSharedBadges().should('have.length', 1);
      }
    );
  });

  it('uses the configured default shared library when adding a new item', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: true, canUpdate: false, canDelete: false })).then(
      ({ owner, sharedUser }) => {
        const title = 'Shared Default Movie';
        const imdbId = uniqueImdbId();
        cy.intercept('GET', '/api/v1/external-metadata/search*', {
          statusCode: 200,
          body: { data: buildOmdbSearchResult(title, imdbId) },
        }).as('omdbSearch');
        cy.intercept('GET', '/api/v1/external-metadata/items*', {
          statusCode: 200,
          body: { data: buildOmdbItem(title, imdbId) },
        }).as('omdbItem');

        signInThroughUi(sharedUser);
        SettingsPage.visitShares();
        SettingsPage.getViewIncomingShareButton(owner.shareCode).click();
        cy.intercept('POST', '/api/v1/users/me/settings').as('saveDefaultOwner');
        SettingsPage.getIncomingShareDefaultCheckbox('library', 'movie').check();
        cy.wait('@saveDefaultOwner').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(200);
          expect(request.body.defaultCollectionOwners).to.deep.equal([
            { listType: 'library', contentType: 'movie', ownerUserShareCode: owner.shareCode },
          ]);
        });
        SettingsPage.closeShareDialogByOverlay();

        visitSharedList(sharedUser);
        CollectionPage.getShowFunctionsButton().click();
        CollectionPage.getAddNewButton().click();
        CollectionPage.getNewItemSearchInput().type(title);
        cy.wait('@omdbSearch');
        CollectionPage.getNewItemLibrarySelect().should('have.value', owner.shareCode);
        cy.intercept('POST', '/api/v1/collection-items').as('createItem');
        CollectionPage.getNewItemSaveAndCloseButton().click();
        cy.wait('@omdbItem');
        cy.wait('@createItem').its('request.body.targetOwnerShareCode').should('eq', owner.shareCode);
      }
    );
  });

  it('allows editing with update permission but hides delete', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: true, canDelete: false })).then(
      ({ owner, sharedUser }) => {
        seedOwnerItem(owner, { title: 'Shared Update Movie', externalId: uniqueImdbId() });
        visitSharedList(sharedUser);

        cy.intercept('PUT', '/api/v1/collection-items/**').as('updateItem');
        CollectionPage.getListItemImages().first().click();
        assertDialogPermissions({ update: true, delete: false });
        CollectionPage.getItemDialogEditButton().click();
        CollectionPage.getItemDialogTitleInput().clear().type('Shared Updated Movie');
        CollectionPage.getItemDialogSaveButton().click();
        cy.wait('@updateItem').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(200);
          expect(request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
        });
        cy.contains('Shared Updated Movie').should('be.visible');
      }
    );
  });

  it('allows deleting with delete permission but hides edit action', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: true })).then(
      ({ owner, sharedUser }) => {
        seedOwnerItem(owner, { title: 'Shared Delete Movie', externalId: uniqueImdbId() });
        visitSharedList(sharedUser);

        cy.intercept('DELETE', '/api/v1/collection-items/**').as('deleteItem');
        cy.on('window:confirm', () => true);
        CollectionPage.getListItemImages().first().click();
        assertDialogPermissions({ update: false, delete: true });
        CollectionPage.getItemDialogDeleteButton().click();
        cy.wait('@deleteItem').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(204);
          expect(request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
        });
        CollectionPage.getEmptyState().should('be.visible');
      }
    );
  });

  it('shows every detail action when all shared permissions are granted', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: true, canUpdate: true, canDelete: true })).then(
      ({ owner, sharedUser }) => {
        seedOwnerItem(owner, { title: 'Shared Full Movie', externalId: uniqueImdbId() });
        visitSharedList(sharedUser);

        CollectionPage.getListItemImages().first().click();
        CollectionPage.getItemDialogSharedLibraryBadge().should('contain.text', owner.username);
        assertDialogPermissions({ update: true, delete: true });
        CollectionPage.getItemDialogMarkFinishedButton().should('be.visible');
      }
    );
  });
});

describe('Collection sharing - content type isolation', () => {
  it('shows only granted content types from a shared library', () => {
    setupShare([grant('library', 'movie', { canRead: true })]).then(({ owner, sharedUser }) => {
      const movieTitle = 'Shared Movie Only';
      const seriesTitle = 'Hidden Shared Series';
      seedOwnerItem(owner, {
        title: movieTitle,
        contentType: 'movie',
        externalId: uniqueImdbId(),
      });
      seedOwnerItem(owner, {
        title: seriesTitle,
        contentType: 'series',
        externalId: uniqueImdbId(),
      });

      visitSharedList(sharedUser);

      cy.intercept('GET', '/api/v1/collection-items*').as('libraryItems');
      CollectionPage.visit();
      cy.wait('@libraryItems').then(({ request, response }) => {
        expect(request.url).to.include('listType=library');
        const items = (response?.body as CollectionPageEnvelope<{ title: string; contentType: string }>).data;
        expect(items.some((item) => item.title === movieTitle)).to.eq(true);
        expect(items.some((item) => item.title === seriesTitle)).to.eq(false);
      });

      CollectionPage.getListItems().should('contain.text', movieTitle);
      CollectionPage.getListItems().should('not.contain.text', seriesTitle);
    });
  });
});

describe('Collection sharing - non-library lists', () => {
  it('shares wishlist items with CRUD when wishlist grant is present', () => {
    setupShare([grant('wishlist', 'movie', { canRead: true, canCreate: true, canUpdate: true, canDelete: true })]).then(
      ({ owner, sharedUser }) => {
        const title = 'Shared Wishlist Movie';
        const imdbId = uniqueImdbId();
        seedOwnerItem(owner, {
          title,
          contentType: 'movie',
          listType: 'wishlist',
          externalId: imdbId,
        });

        // Library has no grant: shared wishlist item must not appear on library.
        visitSharedList(sharedUser, 'library');
        CollectionPage.getEmptyState().should('be.visible');

        visitSharedList(sharedUser, 'wishlist');
        CollectionPage.getListItems().should('contain.text', title);
        CollectionPage.getSharedBadges().should('be.visible');

        cy.intercept('PUT', '/api/v1/collection-items/**').as('updateWishlistItem');
        CollectionPage.getListItemImages().first().click();
        assertDialogPermissions({ update: true, delete: true });
        CollectionPage.getItemDialogEditButton().click();
        CollectionPage.getItemDialogTitleInput().clear().type('Shared Wishlist Updated');
        CollectionPage.getItemDialogSaveButton().click();
        cy.wait('@updateWishlistItem').then(({ request, response }) => {
          expect(response?.statusCode).to.eq(200);
          expect(request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
          expect(request.url).to.include('listType=wishlist');
        });
        cy.contains('Shared Wishlist Updated').should('be.visible');
      }
    );
  });

  it('does not expose wishlist items when only library grant exists', () => {
    setupShare([grant('library', 'movie', { canRead: true })]).then(({ owner, sharedUser }) => {
      const title = 'Private Wishlist Movie';
      seedOwnerItem(owner, {
        title,
        contentType: 'movie',
        listType: 'wishlist',
        externalId: uniqueImdbId(),
      });

      visitSharedList(sharedUser, 'wishlist');
      CollectionPage.getEmptyState().should('be.visible');
    });
  });

  it('shares books list create and read', () => {
    setupShare([grant('books', 'book', { canRead: true, canCreate: true })]).then(({ owner, sharedUser }) => {
      const title = 'Shared Owned Book';
      seedOwnerItem(owner, {
        title,
        contentType: 'book',
        listType: 'books',
        externalId: '9780306406157',
      });

      visitSharedList(sharedUser, 'books');
      CollectionPage.getListItems().should('contain.text', title);
      CollectionPage.getSharedBadges().should('be.visible');

      // Create target available for books grant.
      CollectionPage.getShowFunctionsButton().click();
      CollectionPage.getAddNewButton().click();
      CollectionPage.getNewItemManualModeButton().click();
      CollectionPage.getNewItemLibrarySelect().find('option').should('have.length.at.least', 2);
      CollectionPage.getNewItemLibrarySelect().select(owner.shareCode);
      CollectionPage.getNewItemLibrarySelect().should('have.value', owner.shareCode);
    });
  });

  it('marks shared books completed and uncompleted from tracker management', () => {
    setupShare([grant('books', 'book', { canRead: true })]).then(({ owner, sharedUser }) => {
      seedOwnerItem(owner, {
        title: 'Shared Bulk Book',
        contentType: 'book',
        listType: 'books',
        externalId: '9780140328721',
      });

      signInThroughUi(sharedUser);
      SettingsPage.visitManageTrackerData();
      SettingsPage.getManageTrackerLibrarySelect().select(owner.shareCode);
      cy.on('window:confirm', () => true);

      cy.intercept('POST', '/api/v1/collection-items/actions/mark-books-completed*').as('markSharedBooksCompleted');
      SettingsPage.getMarkAllBooksCompletedButton().should('be.enabled').click();
      cy.wait('@markSharedBooksCompleted').then(({ request, response }) => {
        expect(request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
        expect(response?.statusCode).to.eq(200);
      });

      cy.intercept('POST', '/api/v1/collection-items/actions/mark-books-uncompleted*').as('markSharedBooksUncompleted');
      SettingsPage.getMarkAllBooksUncompletedButton().should('be.enabled').click();
      cy.wait('@markSharedBooksUncompleted').then(({ request, response }) => {
        expect(request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
        expect(response?.statusCode).to.eq(200);
      });
    });
  });

  it('allows editing shared tracking progress with tracking update grant', () => {
    setupShare([grant('tracking', 'movie', { canRead: true, canUpdate: true })]).then(({ owner, sharedUser }) => {
      const title = 'Shared Tracking Movie';
      const imdbId = uniqueImdbId();
      seedOwnerItem(owner, {
        title,
        contentType: 'movie',
        listType: 'tracking',
        externalId: imdbId,
      });

      visitSharedList(sharedUser, 'tracking');
      CollectionPage.getListItems().should('contain.text', title);
      CollectionPage.getSharedBadges().should('be.visible');

      cy.intercept('PUT', '/api/v1/collection-items/**').as('updateTracking');
      CollectionPage.getListItemImages().first().click();
      assertDialogPermissions({ update: true, delete: false });
      CollectionPage.getItemDialogEditButton().click();
      CollectionPage.getItemDialogTitleInput().clear().type('Shared Tracking Renamed');
      CollectionPage.getItemDialogSaveButton().click();
      cy.wait('@updateTracking').then(({ request, response }) => {
        expect(response?.statusCode).to.eq(200);
        expect(request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
        expect(request.url).to.include('listType=tracking');
      });

      // Owner row updated (shared tracking, not a copy).
      requestAs<CollectionPageEnvelope<{ title: string }>>(
        owner,
        'GET',
        '/api/v1/collection-items?listType=tracking&limit=50'
      ).then((response) => {
        expect(response.body.data.some((item) => item.title === 'Shared Tracking Renamed')).to.eq(true);
      });
    });
  });
});

describe('Collection sharing - shared list filter', () => {
  it('filters library list by mine / shared / all via URL and float actions', () => {
    setupShare([grant('library', 'movie', { canRead: true })]).then(({ owner, sharedUser }) => {
      const ownTitle = 'My Own Movie';
      const sharedTitle = 'Shared Filter Movie';
      const ownImdb = uniqueImdbId();
      const sharedImdb = uniqueImdbId();

      seedOwnerItem(owner, { title: sharedTitle, externalId: sharedImdb });
      seedOwnerItem(sharedUser, { title: ownTitle, externalId: ownImdb });

      signInThroughUi(sharedUser);
      cy.intercept('GET', '/api/v1/collection-items*').as('allItems');
      CollectionPage.visit();
      cy.wait('@allItems').then(({ request, response }) => {
        expect(request.url).to.not.include('shared=');
        const titles = (response?.body as CollectionPageEnvelope<{ title: string }>).data.map((item) => item.title);
        expect(titles).to.include(ownTitle);
        expect(titles).to.include(sharedTitle);
      });
      CollectionPage.getListItems().should('contain.text', ownTitle).and('contain.text', sharedTitle);
      CollectionPage.getSharedBadges().should('have.length.at.least', 1);

      cy.intercept('GET', '/api/v1/collection-items*shared=mine*').as('mineItems');
      openFloatFilters();
      CollectionPage.getCollectionFilterButton('sharedMine').click();
      cy.wait('@mineItems').then(({ request, response }) => {
        expect(request.url).to.include('shared=mine');
        const titles = (response?.body as CollectionPageEnvelope<{ title: string }>).data.map((item) => item.title);
        expect(titles).to.include(ownTitle);
        expect(titles).to.not.include(sharedTitle);
      });
      CollectionPage.getListItems().should('contain.text', ownTitle);
      CollectionPage.getListItems().should('not.contain.text', sharedTitle);
      CollectionPage.getSharedBadges().should('not.exist');

      cy.intercept('GET', '/api/v1/collection-items*shared=shared*').as('sharedItems');
      openFloatFilters();
      CollectionPage.getCollectionFilterButton('sharedOnly').click();
      cy.wait('@sharedItems').then(({ request, response }) => {
        expect(request.url).to.include('shared=shared');
        const titles = (response?.body as CollectionPageEnvelope<{ title: string }>).data.map((item) => item.title);
        expect(titles).to.include(sharedTitle);
        expect(titles).to.not.include(ownTitle);
      });
      CollectionPage.getListItems().should('contain.text', sharedTitle);
      CollectionPage.getListItems().should('not.contain.text', ownTitle);
      CollectionPage.getSharedBadges().should('have.length', 1);

      // Direct URL entry also works.
      cy.intercept('GET', '/api/v1/collection-items*').as('urlMine');
      CollectionPage.visitLibraryWithSharedFilter('mine');
      cy.wait('@urlMine').its('request.url').should('include', 'shared=mine');
    });
  });

  it('hides shared filters when user has no incoming readable grants', () => {
    createUser('solo').then((solo) => {
      seedOwnerItem(solo, { title: 'Solo Movie', externalId: uniqueImdbId() });
      signInThroughUi(solo);
      CollectionPage.visit();
      openFloatFilters();
      cy.getByTestId('collection-filter-sharedMine').should('not.exist');
      cy.getByTestId('collection-filter-sharedOnly').should('not.exist');
    });
  });
});

describe('Collection sharing - image refresh', () => {
  it('refreshes images for a shared library with update permission', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: true, canDelete: false })).then(
      ({ owner, sharedUser }) => {
        seedOwnerItem(owner, { title: 'Shared Image Refresh Movie', externalId: uniqueImdbId() });
        signInThroughUi(sharedUser);
        SettingsPage.visitMediaRefresh();

        SettingsPage.getMediaRefreshLibrarySelect().should('be.visible').select(owner.shareCode);
        cy.intercept('POST', '/api/v1/collection-items/actions/refresh-images*').as('refreshImages');
        cy.on('window:confirm', () => true);
        SettingsPage.getImageRefreshStartButton().click();

        cy.wait('@refreshImages').then((interception) => {
          expect(interception.request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
          expect(interception.response?.statusCode).to.eq(200);
        });
      }
    );
  });

  it('does not offer shared library for refresh without update grant', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: false })).then(
      ({ owner, sharedUser }) => {
        signInThroughUi(sharedUser);
        SettingsPage.visitMediaRefresh();
        SettingsPage.findMediaRefreshLibrarySelect().should('not.exist');
        // Own library path still present via start button without select when no shared update options.
        SettingsPage.getImageRefreshStartButton().should('be.visible');
        void owner;
      }
    );
  });
});

describe('Collection sharing - tracking dual path', () => {
  it('copies a shared library movie into the viewer own tracking when marked watched', () => {
    setupShare(libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: false })).then(
      ({ owner, sharedUser }) => {
        const title = 'Shared Tracker Movie';
        const imdbId = uniqueImdbId();
        seedOwnerItem(owner, { title, externalId: imdbId });
        visitSharedList(sharedUser);

        cy.intercept('POST', '/api/v1/collection-items/*/*/tracking*').as('markWatched');
        cy.on('window:confirm', () => true);

        CollectionPage.getListItems().contains(title).click();
        CollectionPage.expectItemDialogActionsVisible();
        CollectionPage.getItemDialogMarkFinishedButton().click();

        cy.wait('@markWatched').then((interception) => {
          expect(interception.request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
          expect(interception.response?.statusCode).to.eq(200);
        });

        cy.intercept('GET', '/api/v1/collection-items?*listType=tracking*').as('getTrackingItems');
        CollectionPage.visitTracking();
        cy.wait('@getTrackingItems').then(({ response }) => {
          const items = (response?.body as CollectionPageEnvelope<{ title: string; ownerShareCode?: string }>).data;
          const trackingItem = items.find((item) => item.title === title);
          expect(trackingItem, 'viewer owns tracking twin').to.exist;
          // Mapper always includes a share code. It must identify the viewer, not source owner.
          expect(trackingItem?.ownerShareCode).to.eq(sharedUser.shareCode);
          expect(trackingItem?.ownerShareCode).to.not.eq(owner.shareCode);
        });
        CollectionPage.getListItems().should('contain.text', title);
        CollectionPage.getSharedBadges().should('not.exist');
      }
    );
  });
});
