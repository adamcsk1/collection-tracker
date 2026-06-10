import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';
import { TagManagementPage } from '../page-objects/tag-management.po';

/**
 * Builds a collection item that also carries a custom tag alongside #movie.
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
    cy.intercept('GET', '/api/v1/tag-management').as('getTagManagement');
    TagManagementPage.visit();
    cy.wait('@getTagManagement');
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
    TagManagementPage.getWeightInput(customTag).type('{selectall}5');
    TagManagementPage.getWeightInput(customTag).should('have.value', '5');
  });

  it('can check the image-border checkbox', () => {
    TagManagementPage.getImageBorderCheckbox(customTag).should('not.be.checked');
    TagManagementPage.getImageBorderCheckbox(customTag).check();
    TagManagementPage.getImageBorderCheckbox(customTag).should('be.checked');
  });

  it('can check the text-color checkbox', () => {
    TagManagementPage.getTextColorCheckbox(customTag).should('not.be.checked');
    TagManagementPage.getTextColorCheckbox(customTag).check();
    TagManagementPage.getTextColorCheckbox(customTag).should('be.checked');
  });

  it('can check the image-badge checkbox', () => {
    TagManagementPage.getImageBadgeCheckbox(customTag).should('not.be.checked');
    TagManagementPage.getImageBadgeCheckbox(customTag).check();
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
    // Set the checkbox via UI — avoids a race condition where the component's init
    // effect can clear API-seeded entries if it runs before preloadUserTagManagement resolves.
    TagManagementPage.getImageBorderCheckbox(customTag).check();
    TagManagementPage.getImageBorderCheckbox(customTag).should('be.checked');

    cy.on('window:confirm', () => true);
    TagManagementPage.getResetButton().click();

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
