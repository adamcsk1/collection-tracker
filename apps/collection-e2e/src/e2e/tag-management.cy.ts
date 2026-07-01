import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';
import { TagManagementPage } from '../page-objects/tag-management.po';

/**
 * Builds a movie collection item that also carries a custom tag.
 */
const buildItemWithCustomTag = (title: string, customTag: string, imdbId?: string) => {
  const item = buildCollectionItem(title, 'movie', imdbId);
  return { ...item, tags: [...item.tags, customTag] };
};

const buildTagManagement = (
  tag: string,
  overrides: Partial<{
    color: string | null;
    useForImageBorder: boolean;
    useForTextColor: boolean;
    useForImageBadge: boolean;
    weight: number;
  }> = {}
) => ({
  tag,
  color: null,
  useForImageBorder: false,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 0,
  ...overrides,
});

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

const createdUsers: TestUser[] = [];

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

const resetPermissionStorage = (browserWindow: Window): void => {
  browserWindow.sessionStorage.removeItem('CT.AppMode');
  browserWindow.sessionStorage.removeItem('CT.SettingLock');
  browserWindow.localStorage.setItem('CT.AppMode', 'full');
  browserWindow.localStorage.removeItem('CT.SettingLock');
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
  const username = `tm-${label}-${uniqueId()}`;

  return cy
    .request<{ token: string }>({
      method: 'POST',
      url: '/api/v1/sign-up',
      body: { username },
      headers: { Cookie: '' },
    })
    .then((signUpResponse) => {
      const token = signUpResponse.body.token;
      return cy
        .request({ method: 'POST', url: '/api/v1/sign-in', body: { username, token }, headers: { Cookie: '' } })
        .then((signInResponse) => ({
          username,
          token,
          cookie: toCookieHeader(signInResponse),
        }));
    })
    .then((user) =>
      requestAs<{ userShareCode: string }>(user, 'GET', '/api/v1/user/shares').then((sharesResponse) => {
        const createdUser = {
          ...user,
          shareCode: sharesResponse.body.userShareCode,
        };
        createdUsers.push(createdUser);
        return createdUser;
      })
    );
};

const cleanupCreatedUsers = (): void => {
  createdUsers.splice(0).forEach((user) => {
    requestAs(user, 'DELETE', '/api/v1/user');
  });
};

const signInThroughUi = (user: TestUser): void => {
  cy.clearCookies({ log: false });
  cy.visit('/login/#/sign-in', {
    onBeforeLoad: resetPermissionStorage,
  });
  cy.getByTestId('sign-in-username').find('input').type(user.username);
  cy.getByTestId('sign-in-token').find('input').type(user.token, { delay: 0 });
  cy.getByTestId('sign-in-submit').click();
  cy.url().should('include', '/client/');
};

const setupShare = (permissions: SharePermissions): Cypress.Chainable<{ owner: TestUser; sharedUser: TestUser }> => {
  return createUser('owner').then((owner) =>
    createUser('shared').then((sharedUser) => {
      return requestAs(owner, 'POST', '/api/v1/user/shares', {
        sharedWithUserShareCode: sharedUser.shareCode,
        ...permissions,
      }).then(() => ({ owner, sharedUser }));
    })
  );
};

afterEach(() => {
  cleanupCreatedUsers();
});

describe('Tag Management — no custom tags', () => {
  beforeEach(() => {
    cy.autoLogin();
    TagManagementPage.visit();
  });

  it('shows an empty list when the collection has no configurable tags', () => {
    TagManagementPage.getList().find('ct-tag-management-card').should('have.length', 0);
  });
});

describe('Tag Management — custom tag in collection', () => {
  const customTag = '#action';
  const item = buildItemWithCustomTag('Tag Management Movie', customTag);

  beforeEach(() => {
    cy.autoLogin();
    // Wipe any tag management left over from previous specs so each test starts
    // with a clean slate.
    cy.request('POST', '/api/v1/tag-management', []);
    cy.request('POST', '/api/v1/create', item);
    cy.intercept('GET', '/api/v1/statistics').as('getStatistics');
    TagManagementPage.visit();
    cy.wait('@getStatistics');
    TagManagementPage.getRenameInput(customTag).should('have.value', customTag);
  });

  it('shows the custom tag in the management list', () => {
    TagManagementPage.getRenameInput(customTag).should('have.value', customTag);
  });

  it('shows the color button for the custom tag', () => {
    TagManagementPage.getColorButton(customTag).should('be.visible');
  });

  it('shows the weight input for the custom tag', () => {
    TagManagementPage.getWeightInput(customTag).should('be.visible');
  });

  it('shows the image-border checkbox for the custom tag', () => {
    TagManagementPage.getImageBorderCheckbox(customTag).should('exist');
  });

  it('shows the text-color checkbox for the custom tag', () => {
    TagManagementPage.getTextColorCheckbox(customTag).should('exist');
  });

  it('shows the image-badge checkbox for the custom tag', () => {
    TagManagementPage.getImageBadgeCheckbox(customTag).should('exist');
  });

  it('can set a weight value for the custom tag', () => {
    cy.intercept('POST', '/api/v1/tag-management').as('saveTagManagement');
    TagManagementPage.getWeightInput(customTag).type('{selectall}5');
    cy.wait('@saveTagManagement');
    TagManagementPage.getWeightInput(customTag).should('have.value', '5');
  });

  it('can check the image-border checkbox', () => {
    cy.intercept('POST', '/api/v1/tag-management').as('saveTagManagement');
    TagManagementPage.getImageBorderCheckbox(customTag).should('not.be.checked');
    TagManagementPage.getImageBorderCheckbox(customTag).check();
    cy.wait('@saveTagManagement');
    TagManagementPage.getImageBorderCheckbox(customTag).should('be.checked');
  });

  it('can check the text-color checkbox', () => {
    cy.intercept('POST', '/api/v1/tag-management').as('saveTagManagement');
    TagManagementPage.getTextColorCheckbox(customTag).should('not.be.checked');
    TagManagementPage.getTextColorCheckbox(customTag).check();
    cy.wait('@saveTagManagement');
    TagManagementPage.getTextColorCheckbox(customTag).should('be.checked');
  });

  it('can check the image-badge checkbox', () => {
    cy.intercept('POST', '/api/v1/tag-management').as('saveTagManagement');
    TagManagementPage.getImageBadgeCheckbox(customTag).should('not.be.checked');
    TagManagementPage.getImageBadgeCheckbox(customTag).check();
    cy.wait('@saveTagManagement');
    TagManagementPage.getImageBadgeCheckbox(customTag).should('be.checked');
  });
});

describe('Tag Management — reset', () => {
  const customTag = '#drama';
  const item = buildItemWithCustomTag('Reset Tag Management Movie', customTag);

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', item);
    TagManagementPage.visit();
  });

  it('clears tag management after confirming reset', () => {
    cy.intercept('POST', '/api/v1/tag-management').as('saveTagManagement');
    // Set the checkbox via UI — avoids a race condition where the component's init
    // effect can clear API-seeded entries if it runs before preloadUserTagManagement resolves.
    TagManagementPage.getImageBorderCheckbox(customTag).check();
    cy.wait('@saveTagManagement');
    TagManagementPage.getImageBorderCheckbox(customTag).should('be.checked');

    cy.intercept('POST', '/api/v1/tag-management').as('resetTagManagement');
    cy.on('window:confirm', () => true);
    TagManagementPage.getResetButton().click();
    cy.wait('@resetTagManagement');

    TagManagementPage.getImageBorderCheckbox(customTag).should('not.be.checked');
  });
});

describe('Tag Management — rename', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/tag-management', []);
  });

  it('renames a custom tag everywhere for the current user', () => {
    const oldTag = '#rename-old';
    const newTag = '#rename-new';
    cy.request('POST', '/api/v1/create', buildItemWithCustomTag('Rename Tag Movie', oldTag, 'tt9910001'));
    cy.intercept('GET', '/api/v1/statistics').as('getStatistics');
    cy.intercept('POST', '/api/v1/tag-management/rename').as('renameTag');
    TagManagementPage.visit();
    cy.wait('@getStatistics');

    cy.on('window:confirm', () => true);
    TagManagementPage.getRenameInput(oldTag).type(`{selectall}${newTag}`);
    TagManagementPage.getRenameButton(oldTag).click();
    cy.wait('@renameTag');

    TagManagementPage.getRenameInput(newTag).should('have.value', newTag);
    TagManagementPage.findRenameInputHost(oldTag).should('not.exist');
    cy.request('/api/v1/statistics').its('body.tagCounts').should('deep.include', { tag: newTag, count: 1 });
  });

  it('merges into an existing custom tag', () => {
    const oldTag = '#merge-old';
    const newTag = '#merge-new';
    cy.request('POST', '/api/v1/create', buildItemWithCustomTag('Merge Old Tag Movie', oldTag, 'tt9910002'));
    cy.request('POST', '/api/v1/create', buildItemWithCustomTag('Merge New Tag Movie', newTag, 'tt9910003'));
    cy.intercept('GET', '/api/v1/statistics').as('getStatistics');
    cy.intercept('POST', '/api/v1/tag-management/rename').as('renameTag');
    TagManagementPage.visit();
    cy.wait('@getStatistics');

    cy.on('window:confirm', () => true);
    TagManagementPage.getRenameInput(oldTag).type(`{selectall}${newTag}`);
    TagManagementPage.getRenameButton(oldTag).click();
    cy.wait('@renameTag');

    TagManagementPage.getRenameInput(newTag).should('have.value', newTag);
    TagManagementPage.findRenameInputHost(oldTag).should('not.exist');
    cy.request('/api/v1/statistics').its('body.tagCounts').should('deep.include', { tag: newTag, count: 2 });
  });

  it('keeps a shared visible tag when the current user own tag is renamed', () => {
    const oldTag = '#shared-rename-old';
    const newTag = '#shared-rename-new';

    return setupShare({ canRead: true, canCreate: false, canUpdate: false, canDelete: false }).then(
      ({ owner, sharedUser }) => {
        requestAs(
          owner,
          'POST',
          '/api/v1/create',
          buildItemWithCustomTag('Shared Rename Owner Movie', oldTag, 'tt9910004')
        );
        requestAs(
          sharedUser,
          'POST',
          '/api/v1/create',
          buildItemWithCustomTag('Shared Rename Current User Movie', oldTag, 'tt9910005')
        );
        requestAs(sharedUser, 'POST', '/api/v1/tag-management', []);
        signInThroughUi(sharedUser);
        cy.intercept('GET', '/api/v1/statistics').as('getStatistics');
        cy.intercept('POST', '/api/v1/tag-management/rename').as('renameTag');
        TagManagementPage.visit();
        cy.wait('@getStatistics');

        cy.on('window:confirm', () => true);
        TagManagementPage.getRenameInput(oldTag).type(`{selectall}${newTag}`);
        TagManagementPage.getRenameButton(oldTag).click();
        cy.wait('@renameTag');

        TagManagementPage.getRenameInput(oldTag).should('have.value', oldTag);
        TagManagementPage.getRenameInput(newTag).should('have.value', newTag);
        requestAs<{ tagCounts: Array<{ tag: string; count: number }> }>(sharedUser, 'GET', '/api/v1/statistics')
          .its('body.tagCounts')
          .should('deep.include', { tag: oldTag, count: 1 })
          .and('deep.include', { tag: newTag, count: 1 });
      }
    );
  });

  it('does not rename a shared visible tag when the current user owns no matching item tags', () => {
    const oldTag = '#shared-only-old';
    const newTag = '#shared-only-new';

    return setupShare({ canRead: true, canCreate: false, canUpdate: false, canDelete: false }).then(
      ({ owner, sharedUser }) => {
        requestAs(
          owner,
          'POST',
          '/api/v1/create',
          buildItemWithCustomTag('Shared Only Owner Movie', oldTag, 'tt9910006')
        );
        requestAs(sharedUser, 'POST', '/api/v1/tag-management', []);
        signInThroughUi(sharedUser);
        cy.intercept('GET', '/api/v1/statistics').as('getStatistics');
        cy.intercept('POST', '/api/v1/tag-management/rename').as('renameTag');
        TagManagementPage.visit();
        cy.wait('@getStatistics');

        cy.on('window:confirm', () => true);
        TagManagementPage.getRenameInput(oldTag).type(`{selectall}${newTag}`);
        TagManagementPage.getRenameButton(oldTag).click();
        cy.wait('@renameTag').its('response.body.renamedItemCount').should('eq', 0);

        TagManagementPage.getRenameInput(oldTag).should('have.value', oldTag);
        TagManagementPage.findRenameInputHost(newTag).should('not.exist');
        requestAs<{ tagCounts: Array<{ tag: string; count: number }> }>(sharedUser, 'GET', '/api/v1/statistics')
          .its('body.tagCounts')
          .should('deep.include', { tag: oldTag, count: 1 })
          .and('not.deep.include', { tag: newTag, count: 1 });
      }
    );
  });

  it('keeps the target tag management config when merging tags', () => {
    const oldTag = '#merge-config-old';
    const newTag = '#merge-config-new';
    const targetConfig = buildTagManagement(newTag, { color: '#00ff00', useForImageBadge: true, weight: 8 });
    cy.request('POST', '/api/v1/create', buildItemWithCustomTag('Merge Config Old Movie', oldTag, 'tt9910007'));
    cy.request('POST', '/api/v1/create', buildItemWithCustomTag('Merge Config New Movie', newTag, 'tt9910008'));
    cy.request('POST', '/api/v1/tag-management', [
      buildTagManagement(oldTag, { color: '#ff0000', useForImageBorder: true, weight: 3 }),
      targetConfig,
    ]);
    cy.intercept('GET', '/api/v1/statistics').as('getStatistics');
    cy.intercept('POST', '/api/v1/tag-management/rename').as('renameTag');
    TagManagementPage.visit();
    cy.wait('@getStatistics');

    cy.on('window:confirm', () => true);
    TagManagementPage.getRenameInput(oldTag).type(`{selectall}${newTag}`);
    TagManagementPage.getRenameButton(oldTag).click();
    cy.wait('@renameTag');

    cy.request('/api/v1/tag-management')
      .its('body')
      .should('deep.include', targetConfig)
      .and('not.deep.include', buildTagManagement(oldTag, { color: '#ff0000', useForImageBorder: true, weight: 3 }));
  });
});

describe('Tag Management — effect on collection item', () => {
  const customTag = '#scifi';
  const item = buildItemWithCustomTag('Scifi Collection Movie', customTag);
  const tagColor = '#ff4500';

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', item);
  });

  it('applies the tag color as an image border when useForImageBorder is enabled', () => {
    cy.request('POST', '/api/v1/tag-management', [
      {
        tag: customTag,
        color: tagColor,
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 0,
      },
    ]);
    CollectionPage.visit();
    CollectionPage.getListItemImages().first().invoke('css', 'border-color').should('not.equal', 'rgba(0, 0, 0, 0)');
  });

  it('shows the image badge when useForImageBadge is enabled', () => {
    cy.request('POST', '/api/v1/tag-management', [
      {
        tag: customTag,
        color: tagColor,
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 0,
      },
    ]);
    CollectionPage.visit();
    // The badge anchor appears inside the image container
    CollectionPage.getListItemImages().first().find('.badge').should('be.visible').and('contain.text', customTag);
  });
});
