import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';
import { TagManagementPage } from '../page-objects/tag-management.po';

/**
 * Builds a movie collection item that also carries a custom tag.
 */
const buildItemWithCustomTag = (title: string, customTag: string) => {
  const item = buildCollectionItem(title, 'movie');
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
    TagManagementPage.getList().should('contain.text', customTag);
  });

  it('shows the custom tag in the management list', () => {
    TagManagementPage.getList().should('contain.text', customTag);
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
