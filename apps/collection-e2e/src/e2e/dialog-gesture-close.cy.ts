import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

const openMovieItemDialog = (title: string, imdbId: string): void => {
  cy.autoLogin();
  cy.request('POST', '/api/v1/create', buildCollectionItem(title, 'movie', imdbId));
  CollectionPage.visit();
  CollectionPage.getListItems().contains(title).should('be.visible');
  CollectionPage.getListItemImages().first().click();
  CollectionPage.getItemDialogHost().should('be.visible');
};

describe('Dialog gesture close', () => {
  it('closes the active dialog from the mobile left screen edge', () => {
    cy.viewport('iphone-x');
    openMovieItemDialog('Left Edge Gesture Movie', 'tt7100011');

    CollectionPage.swipeActiveDialogFromLeftEdge();

    CollectionPage.getItemDialogShellHost().should('not.exist');
  });

  it('closes the active dialog from the mobile right screen edge', () => {
    cy.viewport('iphone-x');
    openMovieItemDialog('Right Edge Gesture Movie', 'tt7100012');

    CollectionPage.swipeActiveDialogFromRightEdge();

    CollectionPage.getItemDialogShellHost().should('not.exist');
  });

  it('does not close from an edge swipe on desktop', () => {
    cy.viewport(1000, 800);
    openMovieItemDialog('Desktop Edge Gesture Movie', 'tt7100013');

    CollectionPage.swipeActiveDialogFromLeftEdge();

    CollectionPage.getItemDialogHost().should('be.visible');
  });

  it('closes only the top stacked dialog from a mobile screen edge', () => {
    const title = 'Stacked Gesture Test Show';
    const imdbId = 'tt7100014';

    cy.viewport('iphone-x');
    cy.autoLogin();
    cy.request('POST', '/api/v1/create', {
      ...buildCollectionItem(title, 'series', imdbId),
      listType: 'tracking',
    });
    CollectionPage.visitTracking();
    CollectionPage.getListItems().contains(title).click();
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogManageSeriesMetadataButton().click();
    CollectionPage.getSeriesMetadataDialog().should('be.visible');

    CollectionPage.swipeActiveDialogFromRightEdge();

    CollectionPage.getSeriesMetadataDialogHost().should('not.exist');
    CollectionPage.getItemDialogHost().should('be.visible');
    CollectionPage.getItemDialogComponentHost().should((element) => {
      expect(element).not.to.have.class('dialog-stacked');
      expect(element).not.to.have.attr('inert');
      expect(element).not.to.have.attr('aria-hidden');
    });
  });
});
