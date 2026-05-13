import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';
import { StatisticsPage } from '../page-objects/statistics.po';

describe('Statistics — empty collection', () => {
  beforeEach(() => {
    cy.autoLogin();
    StatisticsPage.visit();
  });

  it('shows the empty state message when there are no items', () => {
    StatisticsPage.getEmptyMessage().should('be.visible');
  });
});

describe('Statistics — with movies and series', () => {
  const movieOne = { ...buildCollectionItem('Stats Movie One', 'movie', 'tt9000001'), tags: ['#movie', '#favorite', '#action'] };
  const movieTwo = { ...buildCollectionItem('Stats Movie Two', 'movie', 'tt9000002'), tags: ['#movie', '#drama'] };
  const seriesOne = { ...buildCollectionItem('Stats Series One', 'series', 'tt9000003'), tags: ['#series', '#action'] };

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', movieOne);
    cy.request('POST', '/api/v1/create', movieTwo);
    cy.request('POST', '/api/v1/create', seriesOne);
    StatisticsPage.visit();
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

  it('shows the correct watched count', () => {
    StatisticsPage.getSummaryWatched().should('contain.text', '0');
  });

  it('shows the correct unwatched count', () => {
    StatisticsPage.getSummaryUnwatched().should('contain.text', '3');
  });

  it('navigates to the collection when the all summary card is clicked', () => {
    StatisticsPage.getSummaryAll().click();
    cy.url().should('include', '#/collection');
    cy.url().should('not.include', 'search');
  });

  it('navigates to the collection filtered by movies when the movies summary card is clicked', () => {
    StatisticsPage.getSummaryMovies().click();
    cy.url().should('include', '#/collection');
    CollectionPage.getSearchInput().should('have.value', '#movie');
  });

  it('navigates to the collection filtered by series when the series summary card is clicked', () => {
    StatisticsPage.getSummarySeries().click();
    cy.url().should('include', '#/collection');
    CollectionPage.getSearchInput().should('have.value', '#series');
  });

  it('navigates to the collection filtered by favorites when the favorites summary card is clicked', () => {
    StatisticsPage.getSummaryFavorites().click();
    cy.url().should('include', '#/collection');
    CollectionPage.getSearchInput().should('have.value', '#favorite');
  });

  it('shows tag buttons for custom tags', () => {
    StatisticsPage.getTagButton('#action').should('be.visible');
    StatisticsPage.getTagButton('#drama').should('be.visible');
  });

  it('shows the tags-empty message when no tag is selected', () => {
    StatisticsPage.getTagsEmpty().should('be.visible');
  });

  it('hides the chart canvas when no tag is selected', () => {
    StatisticsPage.getChart().should('not.be.visible');
  });

  it('shows the chart when a tag button is clicked', () => {
    StatisticsPage.getTagButton('#action').click();
    StatisticsPage.getChart().should('be.visible');
  });

  it('hides the chart again when the selected tag is deselected', () => {
    StatisticsPage.getTagButton('#action').click();
    StatisticsPage.getChart().should('be.visible');
    StatisticsPage.getTagButton('#action').click();
    StatisticsPage.getChart().should('not.be.visible');
  });

  it('can select multiple tags and shows the chart', () => {
    StatisticsPage.getTagButton('#action').click();
    StatisticsPage.getTagButton('#drama').click();
    StatisticsPage.getChart().should('be.visible');
  });
});
