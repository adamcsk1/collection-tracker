import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

const waitForWatchingItem = (imdbId: string) => {
  cy.wait('@getWatchingItems')
    .its('response.body.items')
    .should((items: Array<{ IMDbId: string }>) => {
      expect(items.some((item) => item.IMDbId === imdbId)).to.eq(true);
    });
};

describe('Watched episodes dialog', () => {
  const imdbId = 'tt8300002';
  const seriesTitle = 'Watched Episodes Test Show';

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem(seriesTitle, 'series', imdbId),
      listType: 'watching',
    });
    cy.intercept('GET', '/api/v1/items?*listType=watching*').as('getWatchingItems');
    CollectionPage.visitWatching();
    waitForWatchingItem(imdbId);
  });

  it('opens dialog and shows no-metadata message when no metadata exists', () => {
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesNoMetadataMessage().should('be.visible');
    CollectionPage.getWatchedEpisodesManageSeasonMetadataButton().should('be.visible');
  });

  it('opens dialog and shows episodes when metadata exists', () => {
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [
        { season: 1, episodes: 3 },
        { season: 2, episodes: 2 },
      ],
    });

    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesNoMetadataMessage().should('not.exist');
    CollectionPage.getWatchedEpisodesSeasonToggle().should('have.length', 2);
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().should('have.length', 5);
  });

  it('checks individual episodes and saves', () => {
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.intercept('PUT', '/api/v1/watching/**/watched-episodes').as('saveWatchedEpisodes');

    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).check();
    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(1).check();
    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');
  });

  it('uses season toggle to mark all episodes watched', () => {
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.intercept('PUT', '/api/v1/watching/**/watched-episodes').as('saveWatchedEpisodes');

    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesSeasonToggle().first().check();
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).should('be.checked');
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(1).should('be.checked');
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(2).should('be.checked');

    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E03');
  });

  it('unchecks episodes and saves', () => {
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/watched-episodes`, {
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
        { season: 1, episode: 3 },
      ],
    });
    cy.intercept('PUT', '/api/v1/watching/**/watched-episodes').as('saveWatchedEpisodes');

    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(2).should('be.checked').uncheck({ force: true });

    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');
  });

  it('persists watched episodes across dialog re-opens', () => {
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.intercept('PUT', '/api/v1/watching/**/watched-episodes').as('saveWatchedEpisodes');

    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).check();
    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');

    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).should('be.checked');
  });

  it('updates the item dialog after closing while auto-save is pending', () => {
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.intercept('PUT', '/api/v1/watching/**/watched-episodes', (request) => {
      request.continue((response) => {
        response.setDelay(250);
      });
    }).as('saveWatchedEpisodes');

    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).check();
    CollectionPage.closeDialogByOverlay();
    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);

    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E01');
    CollectionPage.closeActiveDialogByOverlay();
    cy.getByTestId('item-dialog').should('not.exist');
    cy.get('.dialog').should('not.exist');
  });

  it('marks all episodes watched from the manage episodes dialog and updates completed filters', () => {
    const incompleteImdbId = 'tt8300003';
    const incompleteSeriesTitle = 'Incomplete Episodes Test Show';
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem(incompleteSeriesTitle, 'series', incompleteImdbId),
      listType: 'watching',
    });
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 2 }],
    });
    cy.request('PUT', `/api/v1/watching/omdb/${incompleteImdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 2 }],
    });
    cy.request('PUT', `/api/v1/watching/omdb/${incompleteImdbId}/watched-episodes`, {
      watchedEpisodes: [{ season: 1, episode: 1 }],
    });
    cy.intercept('PUT', '/api/v1/watching/**/mark-all-watched').as('markAllWatched');
    cy.intercept('PUT', '/api/v1/watching/**/watched-episodes').as('markAllUnwatched');

    cy.reload();
    waitForWatchingItem(imdbId);
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getWatchedEpisodesMarkAllWatchedButton().click();
    cy.wait('@markAllWatched').its('response.statusCode').should('eq', 200);
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');
    CollectionPage.closeDialogByOverlay();
    cy.getByTestId('item-dialog').should('not.exist');
    cy.get('.dialog').should('not.exist');

    CollectionPage.visitWatching();
    waitForWatchingItem(imdbId);
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getCollectionFilterButton('completed').click();
    CollectionPage.getListItems().should('have.length', 1).and('contain.text', seriesTitle);
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getCollectionFilterButton('uncompleted').click();
    CollectionPage.getListItems().should('have.length', 1).and('contain.text', incompleteSeriesTitle);

    CollectionPage.visitWatching();
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getWatchedEpisodesMarkAllWatchedButton().should('not.exist');
    CollectionPage.getWatchedEpisodesMarkAllUnwatchedButton().click();
    cy.wait('@markAllUnwatched').then((interception) => {
      expect(interception.request.body).to.deep.equal({ watchedEpisodes: [] });
      expect(interception.response?.statusCode).to.eq(200);
    });
    CollectionPage.closeDialogByOverlay();
    CollectionPage.getWatchedEpisodesDialogHost().should('not.exist');
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'N/A');
    CollectionPage.closeDialogByOverlay();
    cy.getByTestId('item-dialog').should('not.exist');
    cy.get('.dialog').should('not.exist');

    CollectionPage.visitWatching();
    waitForWatchingItem(imdbId);
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getCollectionFilterButton('uncompleted').click();
    CollectionPage.getListItems().should('have.length', 2);
  });

  it('removes stale watched episodes when season metadata is reduced', () => {
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/watched-episodes`, {
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 3 },
      ],
    });

    cy.request('PUT', `/api/v1/watching/omdb/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 1 }],
    });

    cy.reload();
    waitForWatchingItem(imdbId);
    CollectionPage.getWatchingCompletedBadges().should('have.length', 1);
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E01');

    cy.request('GET', `/api/v1/watching/omdb/${imdbId}/watched-episodes`)
      .its('body.watchedEpisodes')
      .should('deep.equal', [{ season: 1, episode: 1 }]);
  });
});
