import { buildCollectionItem } from '../fixtures/collection-item';
import { ExportImportPage } from '../page-objects/export-import.po';

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

const clearDownloads = () => {
  cy.exec(
    "node -e \"const fs = require('fs'); fs.rmSync('cypress/downloads', { recursive: true, force: true }); fs.mkdirSync('cypress/downloads', { recursive: true });\""
  );
};

describe('Export/Import — tag management export and import', () => {
  const existingTag = `#export-existing-${Date.now()}`;
  const importedTag = `#export-imported-${Date.now()}`;
  const item = {
    ...buildItemWithCustomTag('Import Export Tag Management Movie', existingTag),
    tags: ['#movie', existingTag, importedTag],
  };
  const exportPath = 'cypress/downloads/collection-tracker-tag-management.json';
  const exportedExistingConfig = buildTagManagement(existingTag, {
    color: '#111111',
    useForImageBorder: true,
    weight: 3,
  });
  const exportedImportedConfig = buildTagManagement(importedTag, {
    color: '#222222',
    useForImageBadge: true,
    weight: 2,
  });
  const localExistingConfig = buildTagManagement(existingTag, {
    color: '#999999',
    useForTextColor: true,
    weight: 9,
  });

  beforeEach(() => {
    cy.autoLogin();
    clearDownloads();
    cy.request('POST', '/api/v1/tag-management', []);
    cy.request('POST', '/api/v1/create', item);
    cy.request('POST', '/api/v1/tag-management', [exportedExistingConfig, exportedImportedConfig]);
    cy.intercept('GET', '/api/v1/tag-management').as('getTagManagement');
    ExportImportPage.visit();
    cy.wait('@getTagManagement');
  });

  it('exports tag management and imports them while skipping conflicts', () => {
    ExportImportPage.getTagManagementExportButton().click();
    cy.readFile(exportPath, null, { timeout: 15000 }).should((source) => {
      expect(JSON.parse(source.toString('utf8'))).to.deep.equal({
        type: 'collection-tracker-tag-management',
        version: 1,
        tagManagement: [exportedExistingConfig, exportedImportedConfig],
      });
    });

    cy.request('POST', '/api/v1/tag-management', [localExistingConfig]);
    cy.intercept('GET', '/api/v1/tag-management').as('getLocalTagManagement');
    ExportImportPage.visit();
    cy.wait('@getLocalTagManagement');

    cy.intercept('POST', '/api/v1/tag-management').as('importTagManagement');

    cy.on('window:confirm', () => false);
    ExportImportPage.getTagManagementImportFileInput().selectFile(exportPath, { force: true });
    cy.wait('@importTagManagement');

    cy.request('GET', '/api/v1/tag-management')
      .its('body')
      .should('deep.include', localExistingConfig)
      .and('deep.include', exportedImportedConfig)
      .and('not.deep.include', exportedExistingConfig);
  });
});

describe('Export/Import — collection data export', () => {
  const exportPath = 'cypress/downloads/collection-tracker-export.json';
  const seriesImdbId = 'tt8400001';

  beforeEach(() => {
    cy.autoLogin();
    clearDownloads();
    cy.request('POST', '/api/v1/tag-management', []);
    cy.request('POST', '/api/v1/create', buildCollectionItem('Export Movie', 'movie'));
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Export Series', 'series', seriesImdbId),
      listType: 'series-tracker',
    });
    cy.request('PUT', `/api/v1/series-tracker/${seriesImdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Second'] }],
    });
    cy.request('PUT', `/api/v1/series-tracker/${seriesImdbId}/watched-episodes`, {
      watchedEpisodes: [{ season: 1, episode: 1 }],
    });
    cy.intercept('GET', '/api/v1/export').as('getExport');
    ExportImportPage.visit();
  });

  it('exports collection data to a JSON file', () => {
    ExportImportPage.getCollectionDataExportButton().click();
    cy.wait('@getExport').its('response.statusCode').should('eq', 200);
    cy.readFile(exportPath, null, { timeout: 15000 }).should((source) => {
      const parsed = JSON.parse(source.toString('utf8'));
      expect(parsed.type).to.equal('collection-tracker-export');
      expect(parsed.version).to.equal(1);
      expect(parsed.collectionItems).to.be.an('array');
      expect(parsed.collectionItems.length).to.be.greaterThan(0);
      expect(parsed.tagManagement).to.be.an('array');
      expect(parsed.seriesTrackerData[seriesImdbId]).to.deep.equal({
        seasons: [{ season: 1, episodes: 2, titles: ['Pilot', 'Second'] }],
        watchedEpisodes: [{ season: 1, episode: 1 }],
      });
    });
  });
});
