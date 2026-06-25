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
  const movieTrackerImdbId = 'tt8400002';

  beforeEach(() => {
    cy.autoLogin();
    clearDownloads();
    cy.request('POST', '/api/v1/tag-management', []);
    cy.request('POST', '/api/v1/create', buildCollectionItem('Export Movie', 'movie'));
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Export Series', 'series', seriesImdbId),
      listType: 'series-tracker',
    });
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem('Export Tracker Movie', 'movie', movieTrackerImdbId),
      listType: 'movie-tracker',
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
      const trackerItem = parsed.collectionItems.find(
        (item: { IMDbId: string; listType: string }) =>
          item.IMDbId === movieTrackerImdbId && item.listType === 'movie-tracker'
      );
      expect(trackerItem).to.not.be.undefined;
      expect(trackerItem.title).to.equal('Export Tracker Movie');
    });
  });

  it('imports collection data from an exported JSON file', () => {
    ExportImportPage.getCollectionDataExportButton().click();
    cy.wait('@getExport').its('response.statusCode').should('eq', 200);
    cy.readFile(exportPath, null, { timeout: 15000 }).should('exist');

    cy.request(
      'POST',
      '/api/v1/create',
      buildCollectionItem('Imported State Should Remove This', 'movie', 'tt8500001')
    );
    cy.request('POST', '/api/v1/tag-management', []);
    cy.intercept('POST', '/api/v1/import').as('importCollectionData');

    cy.on('window:confirm', () => true);
    ExportImportPage.getCollectionDataImportFileInput().selectFile(exportPath, { force: true });
    cy.wait('@importCollectionData').its('response.statusCode').should('eq', 200);

    cy.request('GET', '/api/v1/items?limit=1000&offset=0&listType=library')
      .its('body.items')
      .should((items) => {
        const titles = items.map((item: { title: string }) => item.title);
        expect(titles).to.include('Export Movie');
        expect(titles).not.to.include('Imported State Should Remove This');
      });
    cy.request('GET', `/api/v1/series-tracker/${seriesImdbId}/watched-episodes`)
      .its('body.watchedEpisodes')
      .should('deep.equal', [{ season: 1, episode: 1 }]);
    cy.request('GET', '/api/v1/items?limit=1000&offset=0&listType=movie-tracker')
      .its('body.items')
      .should((items) => {
        const titles = items.map((item: { title: string }) => item.title);
        expect(titles).to.include('Export Tracker Movie');
      });
  });

  it('sends selected IMDb ID file content for collection-item import', () => {
    cy.writeFile('cypress/downloads/imdb-import.md', '- https://www.imdb.com/title/tt8600001/\n- tt8600002');
    cy.intercept('POST', '/api/v1/import/collection-items', (request) => {
      expect(request.body).to.deep.equal({ source: '- https://www.imdb.com/title/tt8600001/\n- tt8600002' });
      request.reply({ totalCount: 2, importedCount: 2, skippedCount: 0, errorCount: 0 });
    }).as('importCollectionItems');

    ExportImportPage.getCollectionItemsImdbIdImportFileInput().selectFile('cypress/downloads/imdb-import.md', {
      force: true,
    });
    cy.wait('@importCollectionItems').its('response.statusCode').should('eq', 200);
  });
});
