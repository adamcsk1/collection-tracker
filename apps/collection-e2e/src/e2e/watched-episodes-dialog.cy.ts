import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

describe('Watched episodes dialog', () => {
  const imdbId = 'tt8300002';
  const seriesTitle = 'Watched Episodes Test Show';

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

  it('opens dialog and shows no-metadata message when no metadata exists', () => {
    CollectionPage.getListItemImages({ timeout: 10000 }).first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesNoMetadataMessage().should('be.visible');
    CollectionPage.getWatchedEpisodesManageSeasonMetadataButton().should('be.visible');
  });

  it('opens dialog and shows episodes when metadata exists', () => {
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [
        { season: 1, episodes: 3 },
        { season: 2, episodes: 2 },
      ],
    });

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getListItemImages({ timeout: 10000 }).first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesNoMetadataMessage().should('not.exist');
    CollectionPage.getWatchedEpisodesSeasonToggle().should('have.length', 2);
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().should('have.length', 5);
  });

  it('checks individual episodes and saves', () => {
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/watched-episodes`).as('saveWatchedEpisodes');

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getListItemImages({ timeout: 10000 }).first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).check();
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(1).check();
    CollectionPage.getWatchedEpisodesSaveButton().click();

    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');
  });

  it('uses season toggle to mark all episodes watched', () => {
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/watched-episodes`).as('saveWatchedEpisodes');

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getListItemImages({ timeout: 10000 }).first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesSeasonToggle().first().check();
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).should('be.checked');
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(1).should('be.checked');
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(2).should('be.checked');

    CollectionPage.getWatchedEpisodesSaveButton().click();
    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E03');
  });

  it('unchecks episodes and saves', () => {
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/watched-episodes`, {
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
        { season: 1, episode: 3 },
      ],
    });
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/watched-episodes`).as('saveWatchedEpisodes');

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getListItemImages({ timeout: 10000 }).first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(2).should('be.checked').uncheck({ force: true });
    CollectionPage.getWatchedEpisodesSaveButton().click();

    cy.wait('@saveWatchedEpisodes').its('response.statusCode').should('eq', 200);
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');
  });

  it('persists watched episodes across dialog re-opens', () => {
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/watched-episodes`).as('saveWatchedEpisodes');

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getListItemImages({ timeout: 10000 }).first().click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();

    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).check();
    CollectionPage.getWatchedEpisodesSaveButton().click();
    cy.wait('@saveWatchedEpisodes');

    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogManageWatchedEpisodesButton().click();
    CollectionPage.getWatchedEpisodesEpisodeCheckbox().eq(0).should('be.checked');
  });

  it('marks all episodes watched from the item dialog and updates completed filters', () => {
    const incompleteImdbId = 'tt8300003';
    const incompleteSeriesTitle = 'Incomplete Episodes Test Show';
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem(incompleteSeriesTitle, 'series', incompleteImdbId),
      listType: 'series-tracker',
    });
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 2 }],
    });
    cy.request('PUT', `/api/v1/series-tracker/${incompleteImdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 2 }],
    });
    cy.request('PUT', `/api/v1/series-tracker/${incompleteImdbId}/watched-episodes`, {
      watchedEpisodes: [{ season: 1, episode: 1 }],
    });
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/mark-all-watched`).as('markAllWatched');
    cy.intercept('PUT', `/api/v1/series-tracker/${imdbId}/watched-episodes`).as('markAllUnwatched');

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogMarkAllWatchedButton().click();
    cy.wait('@markAllWatched').its('response.statusCode').should('eq', 200);
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E02');
    CollectionPage.getItemDialogSystemTagsSection().should('contain.text', '#completed');
    CollectionPage.closeDialogByOverlay();

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getSeriesTrackerCompletedBadges().should('have.length', 1);
    CollectionPage.getSeriesTrackerSearchInput().clear().type('#completed');
    CollectionPage.getListItems().should('have.length', 1).and('contain.text', seriesTitle);
    CollectionPage.getSeriesTrackerSearchInput().clear().type('#uncompleted');
    CollectionPage.getListItems().should('have.length', 1).and('contain.text', incompleteSeriesTitle);

    CollectionPage.getSeriesTrackerSearchInput().clear();
    CollectionPage.getListItems().contains(seriesTitle).click();
    CollectionPage.openItemDialogActionsMenu();
    CollectionPage.getItemDialogMarkAllWatchedButton().should('not.exist');
    CollectionPage.getItemDialogMarkAllUnwatchedButton().click();
    cy.wait('@markAllUnwatched').then((interception) => {
      expect(interception.request.body).to.deep.equal({ watchedEpisodes: [] });
      expect(interception.response?.statusCode).to.eq(200);
    });
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'N/A');
    CollectionPage.getItemDialogSystemTagsSection().should('not.contain.text', '#completed');
    CollectionPage.closeDialogByOverlay();

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getSeriesTrackerCompletedBadges().should('have.length', 0);
    CollectionPage.getSeriesTrackerSearchInput().clear().type('#uncompleted');
    CollectionPage.getListItems().should('have.length', 2);
  });

  it('removes stale watched episodes when season metadata is reduced', () => {
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/watched-episodes`, {
      watchedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 3 },
      ],
    });

    cy.request('PUT', `/api/v1/series-tracker/${imdbId}/seasons`, {
      seasons: [{ season: 1, episodes: 1 }],
    });

    CollectionPage.visitSeriesTracker();
    cy.wait('@getSeriesTrackerItems');
    CollectionPage.getSeriesTrackerCompletedBadges().should('have.length', 1);
    CollectionPage.getListItemImages({ timeout: 10000 }).first().click();
    CollectionPage.getItemDialogEpisodeProgressChip().should('contain.text', 'S01E01');

    cy.request('GET', `/api/v1/series-tracker/${imdbId}/watched-episodes`)
      .its('body.watchedEpisodes')
      .should('deep.equal', [{ season: 1, episode: 1 }]);
  });
});
