import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';
import { StatisticsPage } from '../page-objects/statistics.po';

describe('Statistics — empty collection', () => {
  beforeEach(() => {
    cy.autoLogin();
    StatisticsPage.visit();
    StatisticsPage.getEmptyMessage().should('be.visible');
  });

  it('shows the empty state message when there are no items', () => {
    StatisticsPage.getEmptyMessage().should('be.visible');
  });
});

describe('Statistics — with movies and series', () => {
  const movieOne = {
    ...buildCollectionItem('Stats Movie One', 'movie', 'tt9000001'),
    tags: ['#action'],
    favorite: true,
  };
  const movieTwo = { ...buildCollectionItem('Stats Movie Two', 'movie', 'tt9000002'), tags: ['#drama'] };
  const seriesOne = { ...buildCollectionItem('Stats Series One', 'series', 'tt9000003'), tags: ['#action'] };

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', movieOne);
    cy.request('POST', '/api/v1/create', movieTwo);
    cy.request('POST', '/api/v1/create', seriesOne);
    StatisticsPage.visit();
    StatisticsPage.getSummaryAll().should('contain.text', '3');
    StatisticsPage.openTagsDetails();
  });

  it('shows the summary section', () => {
    StatisticsPage.getSummary().should('be.visible');
  });

  it('shows the correct total count', () => {
    StatisticsPage.getSummaryAll().should('contain.text', '3');
  });

  it('shows the correct movies count', () => {
    StatisticsPage.getSummaryMovies().should('contain.text', '2');
  });

  it('shows the correct series count', () => {
    StatisticsPage.getSummarySeries().should('contain.text', '1');
  });

  it('shows the correct favorites count', () => {
    StatisticsPage.getSummaryFavorites().should('contain.text', '1');
  });

  it('shows the correct watched movies count', () => {
    StatisticsPage.getSummaryWatchedMovies().should('contain.text', '0');
  });

  it('shows the correct watched series count', () => {
    StatisticsPage.getSummaryWatchedSeries().should('contain.text', '0');
  });

  it('shows the correct unwatched movies count', () => {
    StatisticsPage.getSummaryUnwatchedMovies().should('contain.text', '2');
  });

  it('shows the correct unwatched library series count', () => {
    StatisticsPage.getSummaryUnwatchedLibrarySeries().should('contain.text', '1');
  });

  it('shows the correct unwatched tracker series count', () => {
    StatisticsPage.getSummaryUnwatchedTrackerSeries().should('contain.text', '0');
  });

  it('navigates to the movie tracker when the watched movies summary card is clicked', () => {
    StatisticsPage.getSummaryWatchedMovies().click();
    cy.url().should('include', '#/collection/watched');
  });

  it('navigates to the series tracker when the watched series summary card is clicked', () => {
    StatisticsPage.getSummaryWatchedSeries().click();
    cy.url().should('include', '#/collection/watching');
  });

  it('navigates to the collection filtered by unwatched movies when the unwatched movies summary card is clicked', () => {
    StatisticsPage.getSummaryUnwatchedMovies().click();
    cy.url().should('include', '#/collection/library');
    cy.url().should('include', 'type=movie');
    cy.url().should('include', 'watched=false');
  });

  it('navigates to the collection filtered by unwatched library series when the unwatched library series summary card is clicked', () => {
    StatisticsPage.getSummaryUnwatchedLibrarySeries().click();
    cy.url().should('include', '#/collection/library');
    cy.url().should('include', 'type=series');
    cy.url().should('include', 'watched=false');
  });

  it('navigates to the series tracker filtered by uncompleted when the unwatched tracker series summary card is clicked', () => {
    StatisticsPage.getSummaryUnwatchedTrackerSeries().click();
    cy.url().should('include', '#/collection/watching');
    cy.url().should('include', 'completed=false');
  });

  it('navigates to the collection when the all summary card is clicked', () => {
    StatisticsPage.getSummaryAll().click();
    cy.url().should('include', '#/collection/library');
    cy.url().should('not.include', 'search');
  });

  it('navigates to the collection filtered by movies when the movies summary card is clicked', () => {
    StatisticsPage.getSummaryMovies().click();
    cy.url().should('include', '#/collection/library');
    cy.url().should('include', 'type=movie');
    CollectionPage.getSearchInput().should('have.value', '');
  });

  it('navigates to the collection filtered by series when the series summary card is clicked', () => {
    StatisticsPage.getSummarySeries().click();
    cy.url().should('include', '#/collection/library');
    cy.url().should('include', 'type=series');
    CollectionPage.getSearchInput().should('have.value', '');
  });

  it('navigates to the collection filtered by favorites when the favorites summary card is clicked', () => {
    StatisticsPage.getSummaryFavorites().click();
    cy.url().should('include', '#/collection/library');
    cy.url().should('include', 'favorite=true');
    CollectionPage.getSearchInput().should('have.value', '');
  });

  it('shows tag buttons for custom tags', () => {
    StatisticsPage.getTagButton('#action').should('be.visible');
    StatisticsPage.getTagButton('#drama').should('be.visible');
  });

  it('shows the tags-empty message when no tag is selected', () => {
    StatisticsPage.getTagsEmpty().should('be.visible');
  });

  it('hides the chart canvas when no tag is selected', () => {
    StatisticsPage.getTagChartCard().should('have.class', 'chart-hidden');
  });

  it('shows the chart when a tag button is clicked', () => {
    StatisticsPage.clickAvailableTagButton('#action');
    StatisticsPage.getTagChartCard().should('not.have.class', 'chart-hidden');
  });

  it('hides the chart again when the selected tag is deselected', () => {
    StatisticsPage.clickAvailableTagButton('#action');
    StatisticsPage.getSelectedTagButton('#action').should('have.attr', 'aria-pressed', 'true');
    StatisticsPage.getTagChartCard().should('not.have.class', 'chart-hidden');
    StatisticsPage.clickSelectedTagButton('#action');
    StatisticsPage.getTagChartCard().should('have.class', 'chart-hidden');
  });

  it('can select multiple tags and shows the chart', () => {
    StatisticsPage.clickAvailableTagButton('#action');
    StatisticsPage.getSelectedTagButton('#action').should('have.attr', 'aria-pressed', 'true');
    StatisticsPage.clickAvailableTagButton('#drama');
    StatisticsPage.getTagChartCard().should('not.have.class', 'chart-hidden');
  });
});

describe('Statistics — with series tracker items', () => {
  const librarySeries = {
    ...buildCollectionItem('Stats Library Series', 'series', 'tt9000004'),
    tags: ['#sci-fi'],
  };

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', librarySeries);
    cy.request('POST', '/api/v1/watching/omdb/tt9000004');
    StatisticsPage.visit();
  });

  it('shows the correct unwatched library series count when a tracker exists', () => {
    StatisticsPage.getSummaryUnwatchedLibrarySeries().should('contain.text', '0');
  });

  it('shows the correct unwatched tracker series count for an incomplete tracker', () => {
    StatisticsPage.getSummaryUnwatchedTrackerSeries().should('contain.text', '1');
  });

  it('shows the correct completed tracker series count for an incomplete tracker', () => {
    StatisticsPage.getSummaryCompletedTrackerSeries().should('contain.text', '0');
  });

  it('navigates to the series tracker filtered by uncompleted when the unwatched tracker series card is clicked', () => {
    StatisticsPage.getSummaryUnwatchedTrackerSeries().click();
    cy.url().should('include', '#/collection/watching');
    cy.url().should('include', 'completed=false');
  });

  it('navigates to the series tracker filtered by completed when the completed tracker series card is clicked', () => {
    StatisticsPage.getSummaryCompletedTrackerSeries().click();
    cy.url().should('include', '#/collection/watching');
    cy.url().should('include', 'completed=true');
  });
});

describe('Statistics — wishlist', () => {
  const wishlistItem = {
    ...buildCollectionItem('Stats Wishlist Movie', 'movie', 'tt9000101'),
    listType: 'wishlist',
  };

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', wishlistItem);
    StatisticsPage.visit();
    StatisticsPage.getSummaryWishlist().should('contain.text', '1');
  });

  it('shows the wishlist count and navigates to the wishlist page', () => {
    StatisticsPage.getSummaryWishlist().should('contain.text', '1');
    StatisticsPage.getSummaryWishlist().click();

    cy.url().should('include', '#/collection/wishlist');
    CollectionPage.getSearchHost().should('not.exist');
    CollectionPage.getListItems().should('contain.text', 'Stats Wishlist Movie');
  });
});
