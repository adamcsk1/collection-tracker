import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';
import { TagConfigsPage } from '../page-objects/tag-configs.po';

/**
 * Builds a collection item that also carries a custom tag alongside #movie.
 */
const buildItemWithCustomTag = (title: string, customTag: string) => {
  const item = buildCollectionItem(title, 'movie');
  return { ...item, tags: [...item.tags, customTag] };
};

describe('Tag Configs — no custom tags', () => {
  beforeEach(() => {
    cy.autoLogin();
    TagConfigsPage.visit();
  });

  it('shows an empty list when the collection has no configurable tags', () => {
    TagConfigsPage.getList().find('ct-tag-config-card').should('have.length', 0);
  });
});

describe('Tag Configs — custom tag in collection', () => {
  const customTag = '#action';
  const item = buildItemWithCustomTag('Tag Config Movie', customTag);

  beforeEach(() => {
    cy.autoLogin();
    // Wipe any tag configs left over from previous specs so each test starts
    // with a clean slate.
    cy.request('POST', '/api/v1/tag/change-config', []);
    cy.request('POST', '/api/v1/create', item);
    // Intercept the statistics call triggered by the page so we can explicitly
    // wait for the tag list to finish loading before tests start asserting.
    cy.intercept('GET', '/api/v1/statistics*').as('getStatistics');
    TagConfigsPage.visit();
    cy.wait('@getStatistics');
  });

  it('shows the custom tag in the config list', () => {
    TagConfigsPage.getList().should('contain.text', customTag);
  });

  it('shows the color button for the custom tag', () => {
    TagConfigsPage.getColorButton(customTag).should('be.visible');
  });

  it('shows the weight input for the custom tag', () => {
    TagConfigsPage.getWeightInput(customTag).should('be.visible');
  });

  it('shows the image-border checkbox for the custom tag', () => {
    TagConfigsPage.getImageBorderCheckbox(customTag).should('exist');
  });

  it('shows the text-color checkbox for the custom tag', () => {
    TagConfigsPage.getTextColorCheckbox(customTag).should('exist');
  });

  it('shows the image-badge checkbox for the custom tag', () => {
    TagConfigsPage.getImageBadgeCheckbox(customTag).should('exist');
  });

  it('can set a weight value for the custom tag', () => {
    TagConfigsPage.getWeightInput(customTag).type('{selectall}5');
    TagConfigsPage.getWeightInput(customTag).should('have.value', '5');
  });

  it('can check the image-border checkbox', () => {
    TagConfigsPage.getImageBorderCheckbox(customTag).should('not.be.checked');
    TagConfigsPage.getImageBorderCheckbox(customTag).check();
    TagConfigsPage.getImageBorderCheckbox(customTag).should('be.checked');
  });

  it('can check the text-color checkbox', () => {
    TagConfigsPage.getTextColorCheckbox(customTag).should('not.be.checked');
    TagConfigsPage.getTextColorCheckbox(customTag).check();
    TagConfigsPage.getTextColorCheckbox(customTag).should('be.checked');
  });

  it('can check the image-badge checkbox', () => {
    TagConfigsPage.getImageBadgeCheckbox(customTag).should('not.be.checked');
    TagConfigsPage.getImageBadgeCheckbox(customTag).check();
    TagConfigsPage.getImageBadgeCheckbox(customTag).should('be.checked');
  });
});

describe('Tag Configs — reset', () => {
  const customTag = '#drama';
  const item = buildItemWithCustomTag('Reset Config Movie', customTag);

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', item);
    TagConfigsPage.visit();
  });

  it('clears tag configs after confirming reset', () => {
    // Set the checkbox via UI — avoids a race condition where the component's init
    // effect can clear API-seeded configs if it runs before preloadUserTagConfigs resolves.
    TagConfigsPage.getImageBorderCheckbox(customTag).check();
    TagConfigsPage.getImageBorderCheckbox(customTag).should('be.checked');

    cy.on('window:confirm', () => true);
    TagConfigsPage.getResetButton().click();

    TagConfigsPage.getImageBorderCheckbox(customTag).should('not.be.checked');
  });
});

describe('Tag Configs — effect on collection item', () => {
  const customTag = '#scifi';
  const item = buildItemWithCustomTag('Scifi Collection Movie', customTag);
  const tagColor = '#ff4500';

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', item);
  });

  it('applies the tag color as an image border when useForImageBorder is enabled', () => {
    cy.request('POST', '/api/v1/tag/change-config', [
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
    CollectionPage.getListItemImages()
      .first()
      .invoke('css', 'border-color')
      .should('not.equal', 'rgba(0, 0, 0, 0)');
  });

  it('shows the image badge when useForImageBadge is enabled', () => {
    cy.request('POST', '/api/v1/tag/change-config', [
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
