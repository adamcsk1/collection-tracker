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
    });
    cy.intercept('GET', '/api/v1/items*').as('getSeriesTrackerItems');
    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
  });

  it('saves manual season metadata', () => {
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/seasons`).as('saveSeriesMetadata');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getSeriesMetadataRefreshButton().should('be.visible');

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
  });

  it('reopens the item dialog when the metadata dialog is closed without saving', () => {
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();

    CollectionPage.getSeriesMetadataAddButton().click();
    cy.get('.dialog-overlay').click({ force: true });

    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().should('be.visible');
  });

  it('removes stored season metadata', () => {
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [
        { season: 1, episodes: 3 },
        { season: 2, episodes: 2 },
      ],
    });
    cy.intercept('DELETE', `/api/v1/series-tracker/${imdbId}/seasons`).as('deleteSeriesMetadata');
    cy.on('window:confirm', () => true);

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesDialog().should('be.visible');
    CollectionPage.getWatchedEpisodesNoMetadataMessage().should('not.exist');
    cy.get('.dialog-overlay').click({ force: true });

    cy.getByTestId('watched-episodes-dialog').should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getSeriesMetadataRemoveAllButton().click();

    cy.wait('@deleteSeriesMetadata').its('response.statusCode').should('eq', 200);
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getSeriesMetadataDialogHost().should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();
    CollectionPage.getWatchedEpisodesNoMetadataMessage().should('be.visible');
  });

  it('saves and restores episode titles in the metadata dialog', () => {
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/seasons`).as('saveSeriesMetadata');

    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();

    CollectionPage.getSeriesMetadataAddButton().click();
    CollectionPage.getSeriesMetadataEpisodeInputs().first().clear().type('2');

    CollectionPage.getSeriesMetadataEpisodeTitleToggles().first().click();
    CollectionPage.getSeriesMetadataEpisodeTitleInputs().eq(0).type('Alpha');
    CollectionPage.getSeriesMetadataEpisodeTitleInputs().eq(1).type('Beta');

    CollectionPage.getSeriesMetadataSaveButton().click();
    cy.wait('@saveSeriesMetadata').its('response.statusCode').should('eq', 200);

    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();

    CollectionPage.getSeriesMetadataEpisodeTitleToggles().first().click();
    CollectionPage.getSeriesMetadataEpisodeTitleInputs().eq(0).should('have.value', 'Alpha');
    CollectionPage.getSeriesMetadataEpisodeTitleInputs().eq(1).should('have.value', 'Beta');
  });

  it('shows no-metadata message when no metadata is set', () => {
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();

    CollectionPage.getSeriesMetadataNoMetadataMessage().should('be.visible');
  });
});
