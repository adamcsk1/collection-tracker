import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

describe('Series metadata dialog', () => {
  const imdbId = 'tt8300001';
  const seriesTitle = 'Metadata Dialog Test Show';

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem(seriesTitle, 'series', imdbId),
      listType: 'series-tracker',
      fetchSeriesMetadata: false,
    });
    CollectionPage.visitSeriesTracker();
  });

  it('saves manual season metadata and uses it for progress options', () => {
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/seasons`).as('saveSeriesMetadata');
    cy.intercept('PUT', '/api/v1/change/*').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogRefreshSeriesMetadataButton().should('be.visible');
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();

    CollectionPage.getSeriesMetadataMessage().should('contain.text', 'Season and episode counts can come from OMDb');
    CollectionPage.getSeriesMetadataAddButton().click();
    CollectionPage.getSeriesMetadataAddButton().click();

    CollectionPage.getSeriesMetadataEpisodeInputs().eq(0).invoke('val', '0').trigger('input');
    CollectionPage.getSeriesMetadataValidation().should('be.visible');
    CollectionPage.getSeriesMetadataSaveButton().should('be.disabled');

    CollectionPage.getSeriesMetadataEpisodeInputs().eq(0).invoke('val', '3').trigger('input');
    CollectionPage.getSeriesMetadataEpisodeInputs().eq(1).invoke('val', '2').trigger('input');
    CollectionPage.getSeriesMetadataValidation().should('not.exist');
    CollectionPage.getSeriesMetadataSaveButton().click();

    cy.wait('@saveSeriesMetadata').its('response.statusCode').should('eq', 200);
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().should('be.visible');

    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogWatchedUpToSeasonSelect().find('option').should('have.length', 3);
    CollectionPage.getItemDialogWatchedUpToSeasonSelect().select('1');
    CollectionPage.getItemDialogWatchedUpToEpisodeSelect().find('option').should('have.length', 4);
    CollectionPage.getItemDialogWatchedUpToEpisodeSelect().select('3');
    CollectionPage.getItemDialogWatchedUpToSeasonSelect().select('2');
    CollectionPage.getItemDialogWatchedUpToEpisodeSelect().find('option').should('have.length', 3);
    CollectionPage.getItemDialogWatchedUpToEpisodeSelect().select('2');
    CollectionPage.getItemDialogSaveButton().click();

    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S02E02');
  });

  it('reopens the item dialog when the metadata dialog is closed without saving', () => {
    CollectionPage.getListItemImages().first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();

    CollectionPage.getSeriesMetadataAddButton().click();
    CollectionPage.getSeriesMetadataCloseButton().click();

    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().should('be.visible');
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogWatchedUpToSeasonSelect().find('option').should('have.length', 51);
  });

  it('removes stored season metadata and falls back to default progress options', () => {
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [
        { season: 1, episodes: 3 },
        { season: 2, episodes: 2 },
      ],
    });
    cy.intercept('DELETE', `/api/v1/series-tracker/${imdbId}/seasons`).as('deleteSeriesMetadata');
    cy.on('window:confirm', () => true);

    CollectionPage.visitSeriesTracker();
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogWatchedUpToSeasonSelect().find('option').should('have.length', 3);
    CollectionPage.getItemDialogReadOnlyButton().click();

    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogRemoveSeriesMetadataButton().click();

    cy.wait('@deleteSeriesMetadata').its('response.statusCode').should('eq', 200);
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogWatchedUpToSeasonSelect().find('option').should('have.length', 51);
  });
});
