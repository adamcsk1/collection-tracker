import { buildCollectionItem } from '../fixtures/collection-item';
import { buildOmdbItem, buildOmdbSearchResult } from '../fixtures/omdb';
import { CollectionPage } from '../page-objects/collection.po';
import { SettingsPage } from '../page-objects/settings.po';

interface SharePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

interface TestUser {
  username: string;
  token: string;
  cookie: string;
  shareCode: string;
}

const uniqueId = () => `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

const getSetCookieHeaders = (headers: Cypress.Response<unknown>['headers']): string[] => {
  const setCookie = headers['set-cookie'];
  if (Array.isArray(setCookie)) return setCookie;
  if (typeof setCookie === 'string') return [setCookie];
  return [];
};

const toCookieHeader = (response: Cypress.Response<unknown>): string => {
  return getSetCookieHeaders(response.headers)
    .map((cookie) => cookie.split(';')[0])
    .filter((cookie) => cookie.startsWith('CT.Token=') || cookie.startsWith('CT.RefreshToken='))
    .join('; ');
};

const requestAs = <ResponseBody = unknown>(
  user: Pick<TestUser, 'cookie'>,
  method: Cypress.HttpMethod,
  url: string,
  body?: Cypress.RequestBody
) => {
  return cy.request<ResponseBody>({
    method,
    url,
    body,
    headers: { Cookie: user.cookie },
  });
};

const createUser = (label: string): Cypress.Chainable<TestUser> => {
  const username = `share-${label}-${uniqueId()}`;

  return cy
    .request<{ token: string }>('POST', '/api/v1/sign-up', { username })
    .then((signUpResponse) => {
      const token = signUpResponse.body.token;
      return cy.request('POST', '/api/v1/sign-in', { username, token }).then((signInResponse) => ({
        username,
        token,
        cookie: toCookieHeader(signInResponse),
      }));
    })
    .then((user) =>
      requestAs<{ userShareCode: string }>(user, 'GET', '/api/v1/user/shares').then((sharesResponse) => ({
        ...user,
        shareCode: sharesResponse.body.userShareCode,
      }))
    );
};

const signInThroughUi = (user: TestUser): void => {
  cy.clearCookies({ log: false });
  cy.visit('/login/#/sign-in', {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('CT.AppMode', 'full');
      win.localStorage.removeItem('CT.SettingLock');
    },
  });
  cy.getByTestId('sign-in-username').find('input').type(user.username);
  cy.getByTestId('sign-in-token').find('input').type(user.token, { delay: 0 });
  cy.getByTestId('sign-in-submit').click();
  cy.url().should('include', '/client/');
};

const setupShare = (permissions: SharePermissions): Cypress.Chainable<{ owner: TestUser; sharedUser: TestUser }> => {
  return createUser('owner').then((owner) =>
    createUser('shared').then((sharedUser) => {
      requestAs(owner, 'POST', '/api/v1/user/shares', {
        sharedWithUserShareCode: sharedUser.shareCode,
        ...permissions,
      });

      return cy.wrap({ owner, sharedUser }, { log: false });
    })
  );
};

const seedOwnerItem = (owner: TestUser, title: string, imdbId: string): void => {
  requestAs(owner, 'POST', '/api/v1/create', buildCollectionItem(title, 'movie', imdbId));
};

const visitSharedCollection = (sharedUser: TestUser): void => {
  signInThroughUi(sharedUser);
  cy.intercept('GET', '/api/v1/items*').as('itemsLoad');
  CollectionPage.visit();
  cy.wait('@itemsLoad');
};

const assertDialogPermissions = (permissions: { update: boolean; delete: boolean }): void => {
  if (permissions.update || permissions.delete) {
    CollectionPage.openItemDialogActionsMenu();
  }

  if (permissions.update) {
    CollectionPage.getItemDialogEditButton().should('be.visible');
    CollectionPage.getItemDialogMarkWatchedButton().should('be.visible');
  } else {
    cy.getByTestId('item-dialog-edit').should('not.exist');
    cy.getByTestId('item-dialog-mark-watched').should('not.exist');
    cy.getByTestId('item-dialog-mark-unwatched').should('not.exist');
  }

  if (permissions.delete) {
    CollectionPage.getItemDialogDeleteButton().should('be.visible');
  } else {
    cy.getByTestId('item-dialog-delete').should('not.exist');
  }
};

describe('Collection sharing - settings management', () => {
  it('creates, updates, removes, and revokes shares from the settings page', () => {
    createUser('owner').then((owner) => {
      createUser('shared').then((sharedUser) => {
        signInThroughUi(owner);
        SettingsPage.visitShares();

        SettingsPage.getShareCode().should('contain.text', owner.shareCode);
        SettingsPage.getAddShareUserHashInput().type(sharedUser.shareCode);
        SettingsPage.getAddShareCanCreateCheckbox().check();
        SettingsPage.getAddShareCanUpdateCheckbox().check();
        SettingsPage.getAddShareCanDeleteCheckbox().check();
        cy.intercept('POST', '/api/v1/user/shares').as('saveShare');
        SettingsPage.getAddShareSubmitButton().click();
        cy.wait('@saveShare').its('response.statusCode').should('eq', 204);

        SettingsPage.getOutgoingShareCanReadCheckbox().should('be.checked');
        SettingsPage.getOutgoingShareCanCreateCheckbox().should('be.checked');
        SettingsPage.getOutgoingShareCanUpdateCheckbox().should('be.checked');
        SettingsPage.getOutgoingShareCanDeleteCheckbox().should('be.checked');

        SettingsPage.getOutgoingShareCanUpdateCheckbox().uncheck();
        cy.wait('@saveShare').its('request.body.canUpdate').should('eq', false);

        cy.on('window:confirm', () => true);
        cy.intercept('DELETE', '/api/v1/user/shares/*').as('removeShare');
        SettingsPage.getRemoveShareButton().click();
        cy.wait('@removeShare').its('response.statusCode').should('eq', 204);

        requestAs(owner, 'POST', '/api/v1/user/shares', {
          sharedWithUserShareCode: sharedUser.shareCode,
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
        });

        signInThroughUi(sharedUser);
        SettingsPage.visitShares();
        cy.contains(owner.username).should('exist');
        cy.intercept('DELETE', '/api/v1/user/shares/incoming/*').as('revokeShare');
        SettingsPage.getRevokeIncomingShareButton().click();
        cy.wait('@revokeShare').its('response.statusCode').should('eq', 204);
      });
    });
  });
});

describe('Collection sharing - item permissions', () => {
  it('shows read-only shared items in the list and details without edit or delete actions', () => {
    setupShare({ canRead: true, canCreate: false, canUpdate: false, canDelete: false }).then(
      ({ owner, sharedUser }) => {
        seedOwnerItem(owner, 'Shared Read Movie', `tt${uniqueId().slice(0, 7)}`);
        visitSharedCollection(sharedUser);

        CollectionPage.getListItems().should('contain.text', 'Shared Read Movie');
        CollectionPage.getSharedBadges().should('be.visible');
        CollectionPage.getListItemImages().first().click();
        CollectionPage.getItemDialogSharedLibraryBadge().should('contain.text', owner.username);
        assertDialogPermissions({ update: false, delete: false });
      }
    );
  });

  it('allows adding a new item to a shared library with create permission', () => {
    setupShare({ canRead: true, canCreate: true, canUpdate: false, canDelete: false }).then(({ owner, sharedUser }) => {
      const title = 'Shared Create Movie';
      const imdbId = `tt${uniqueId().slice(0, 7)}`;
      cy.intercept('GET', '/api/v1/proxy/omdb/search*', {
        statusCode: 200,
        body: buildOmdbSearchResult(title, imdbId),
      }).as('omdbSearch');
      cy.intercept('GET', '/api/v1/proxy/omdb/item*', { statusCode: 200, body: buildOmdbItem(title, imdbId) }).as(
        'omdbItem'
      );

      visitSharedCollection(sharedUser);
      CollectionPage.getShowFunctionsButton().click();
      CollectionPage.getAddNewButton().click();
      CollectionPage.getNewItemSearchInput().type(title);
      cy.wait('@omdbSearch');
      CollectionPage.getNewItemLibrarySelect().select(owner.shareCode);
      cy.intercept('POST', '/api/v1/create').as('createItem');
      CollectionPage.getNewItemSaveAndCloseButton().click();
      cy.wait('@omdbItem');
      cy.wait('@createItem').its('request.body.targetOwnerShareCode').should('eq', owner.shareCode);
      CollectionPage.getListItems().should('contain.text', title);
      CollectionPage.getSharedBadges().should('be.visible');
    });
  });

  it('uses the configured default shared library when adding a new item', () => {
    setupShare({ canRead: true, canCreate: true, canUpdate: false, canDelete: false }).then(({ owner, sharedUser }) => {
      const title = 'Shared Default Movie';
      const imdbId = `tt${uniqueId().slice(0, 7)}`;
      cy.intercept('GET', '/api/v1/proxy/omdb/search*', {
        statusCode: 200,
        body: buildOmdbSearchResult(title, imdbId),
      }).as('omdbSearch');
      cy.intercept('GET', '/api/v1/proxy/omdb/item*', { statusCode: 200, body: buildOmdbItem(title, imdbId) }).as(
        'omdbItem'
      );

      signInThroughUi(sharedUser);
      SettingsPage.visitShares();
      SettingsPage.getDefaultLibrarySelect().select(owner.shareCode);

      visitSharedCollection(sharedUser);
      CollectionPage.getShowFunctionsButton().click();
      CollectionPage.getAddNewButton().click();
      CollectionPage.getNewItemSearchInput().type(title);
      cy.wait('@omdbSearch');
      CollectionPage.getNewItemLibrarySelect().should('have.value', owner.shareCode);
      cy.intercept('POST', '/api/v1/create').as('createItem');
      CollectionPage.getNewItemSaveAndCloseButton().click();
      cy.wait('@omdbItem');
      cy.wait('@createItem').its('request.body.targetOwnerShareCode').should('eq', owner.shareCode);
    });
  });

  it('allows editing and marking watched with update permission but hides delete', () => {
    setupShare({ canRead: true, canCreate: false, canUpdate: true, canDelete: false }).then(({ owner, sharedUser }) => {
      seedOwnerItem(owner, 'Shared Update Movie', `tt${uniqueId().slice(0, 7)}`);
      visitSharedCollection(sharedUser);

      cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
      cy.on('window:confirm', () => true);
      CollectionPage.getListItemImages().first().click();
      assertDialogPermissions({ update: true, delete: false });
      CollectionPage.getItemDialogEditButton().click();
      CollectionPage.getItemDialogTitleInput().clear().type('Shared Updated Movie');
      CollectionPage.getItemDialogSaveButton().click();
      cy.wait('@updateItem')
        .its('request.url')
        .should('include', `ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
      cy.contains('Shared Updated Movie').should('be.visible');
    });
  });

  it('allows deleting with delete permission but hides edit and watched actions', () => {
    setupShare({ canRead: true, canCreate: false, canUpdate: false, canDelete: true }).then(({ owner, sharedUser }) => {
      seedOwnerItem(owner, 'Shared Delete Movie', `tt${uniqueId().slice(0, 7)}`);
      visitSharedCollection(sharedUser);

      cy.intercept('DELETE', '/api/v1/delete/*').as('deleteItem');
      cy.on('window:confirm', () => true);
      CollectionPage.getListItemImages().first().click();
      assertDialogPermissions({ update: false, delete: true });
      CollectionPage.getItemDialogDeleteButton().click();
      cy.wait('@deleteItem')
        .its('request.url')
        .should('include', `ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
      CollectionPage.getEmptyState().should('be.visible');
    });
  });

  it('shows every detail action when all shared permissions are granted', () => {
    setupShare({ canRead: true, canCreate: true, canUpdate: true, canDelete: true }).then(({ owner, sharedUser }) => {
      seedOwnerItem(owner, 'Shared Full Movie', `tt${uniqueId().slice(0, 7)}`);
      visitSharedCollection(sharedUser);

      CollectionPage.getListItemImages().first().click();
      CollectionPage.getItemDialogSharedLibraryBadge().should('contain.text', owner.username);
      assertDialogPermissions({ update: true, delete: true });
    });
  });
});

describe('Collection sharing - image refresh', () => {
  it('refreshes images for a shared library with update permission', () => {
    setupShare({ canRead: true, canCreate: false, canUpdate: true, canDelete: false }).then(({ owner, sharedUser }) => {
      seedOwnerItem(owner, 'Shared Image Refresh Movie', `tt${uniqueId().slice(0, 7)}`);
      signInThroughUi(sharedUser);
      SettingsPage.visitMediaRefresh();

      SettingsPage.getMediaRefreshLibrarySelect().should('be.visible').select(owner.shareCode);
      cy.intercept('POST', '/api/v1/items/refresh-images*').as('refreshImages');
      cy.on('window:confirm', () => true);
      SettingsPage.getImageRefreshStartButton().click();

      cy.wait('@refreshImages').then((interception) => {
        expect(interception.request.url).to.include(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
        expect(interception.response?.statusCode).to.eq(200);
      });
    });
  });
});
