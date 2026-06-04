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

const buildTagConfig = (
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

const clearTagConfigDownload = () => {
  cy.exec(
    "node -e \"const fs = require('fs'); fs.rmSync('cypress/downloads', { recursive: true, force: true }); fs.mkdirSync('cypress/downloads', { recursive: true });\""
  );
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
    cy.intercept('GET', '/api/v1/tag/config').as('getTagConfig');
    TagConfigsPage.visit();
    cy.wait('@getTagConfig');
    TagConfigsPage.getList().should('contain.text', customTag);
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

describe('Tag Configs — import and export', () => {
  const existingTag = `#export-existing-${Date.now()}`;
  const importedTag = `#export-imported-${Date.now()}`;
  const item = {
    ...buildItemWithCustomTag('Import Export Config Movie', existingTag),
    tags: ['#movie', existingTag, importedTag],
  };
  const exportPath = 'cypress/downloads/collection-tracker-tag-configs.json';
  const exportedExistingConfig = buildTagConfig(existingTag, {
    color: '#111111',
    useForImageBorder: true,
    weight: 3,
  });
  const exportedImportedConfig = buildTagConfig(importedTag, {
    color: '#222222',
    useForImageBadge: true,
    weight: 2,
  });
  const localExistingConfig = buildTagConfig(existingTag, {
    color: '#999999',
    useForTextColor: true,
    weight: 9,
  });

  beforeEach(() => {
    cy.autoLogin();
    clearTagConfigDownload();
    cy.request('POST', '/api/v1/tag/change-config', []);
    cy.request('POST', '/api/v1/create', item);
    cy.request('POST', '/api/v1/tag/change-config', [exportedExistingConfig, exportedImportedConfig]);
    cy.intercept('GET', '/api/v1/tag/config').as('getTagConfig');
    TagConfigsPage.visit();
    cy.wait('@getTagConfig');
    TagConfigsPage.getList().should('contain.text', existingTag).and('contain.text', importedTag);
  });

  it('exports tag configs and imports them as an extension while skipping conflicts', () => {
    TagConfigsPage.getExportButton().click();
    cy.readFile(exportPath, null, { timeout: 15000 }).should((source) => {
      expect(JSON.parse(source.toString('utf8'))).to.deep.equal({
        type: 'collection-tracker-tag-configs',
        version: 1,
        tagConfigs: [exportedExistingConfig, exportedImportedConfig],
      });
    });

    cy.request('POST', '/api/v1/tag/change-config', [localExistingConfig]);
    cy.intercept('GET', '/api/v1/tag/config').as('getLocalTagConfig');
    TagConfigsPage.visit();
    cy.wait('@getLocalTagConfig');

    cy.on('window:confirm', () => false);
    cy.intercept('POST', '/api/v1/tag/change-config').as('importTagConfigs');

    TagConfigsPage.getImportFileInput().selectFile(exportPath, { force: true });
    cy.wait('@importTagConfigs');

    cy.request('GET', '/api/v1/tag/config')
      .its('body')
      .should('deep.include', localExistingConfig)
      .and('deep.include', exportedImportedConfig)
      .and('not.deep.include', exportedExistingConfig);
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
    CollectionPage.getListItemImages().first().invoke('css', 'border-color').should('not.equal', 'rgba(0, 0, 0, 0)');
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
