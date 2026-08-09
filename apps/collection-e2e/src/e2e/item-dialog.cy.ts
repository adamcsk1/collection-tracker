import { buildCollectionItem } from '../fixtures/collection-item';
import { CollectionPage } from '../page-objects/collection.po';

const tooltipCenterTolerance = 1;
const actionIconAlignmentTolerance = 1;

describe('Item dialog — edit flow', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/collection-items', buildCollectionItem('Edit Test Movie', 'movie', 'tt7000001'));
    CollectionPage.visit();
  });

  it('shows an action label on touch hold without executing the action', () => {
    cy.viewport('iphone-x');
    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().find('.button-reveal-label-text').should('not.be.visible');
    CollectionPage.getItemDialogActionButtons().then((buttons) => {
      const iconCenters = [...buttons].map((button) => {
        const icon = button.querySelector('.material-icons');
        if (!icon) throw new Error('Dialog action icon is unavailable');
        const iconRect = icon.getBoundingClientRect();
        return iconRect.top + iconRect.height / 2;
      });
      iconCenters.slice(1).forEach((iconCenter) => {
        expect(iconCenter).to.be.closeTo(iconCenters[0], actionIconAlignmentTolerance);
      });
    });

    CollectionPage.getItemDialogEditButton()
      .invoke('attr', 'aria-label')
      .then((label) => {
        CollectionPage.holdItemDialogAction('item-dialog-edit');
        CollectionPage.getDialogActionTooltip().should((tooltip) => {
          expect(tooltip.text().trim()).to.equal(label);
        });
        CollectionPage.getItemDialogEditButton().then((button) => {
          CollectionPage.getItemDialogHost().then((dialog) => {
            CollectionPage.getDialogActionTooltip().should((tooltip) => {
              const buttonRect = button[0].getBoundingClientRect();
              const dialogRect = dialog[0].getBoundingClientRect();
              const tooltipLeft = Number.parseFloat(tooltip[0].style.left);
              expect(tooltipLeft).to.be.closeTo(
                buttonRect.left + buttonRect.width / 2 - dialogRect.left,
                tooltipCenterTolerance
              );
            });
          });
        });
        CollectionPage.releaseHeldItemDialogAction('item-dialog-edit');
        CollectionPage.getDialogActionTooltip().should('not.exist');
      });
    CollectionPage.getItemDialogSaveButton().should('not.exist');

    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogSaveButton().should('be.visible');
    CollectionPage.getItemDialogSaveButton().find('.button-reveal-label-text').should('not.be.visible');
    CollectionPage.getItemDialogSaveButton()
      .invoke('attr', 'aria-label')
      .then((label) => {
        CollectionPage.holdItemDialogAction('item-dialog-save');
        CollectionPage.getDialogActionTooltip().should((tooltip) => {
          expect(tooltip.text().trim()).to.equal(label);
        });
        CollectionPage.releaseHeldItemDialogAction('item-dialog-save');
      });
    CollectionPage.getItemDialogSaveButton().should('be.visible');
  });

  it('reveals a footer action label on keyboard focus', () => {
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogReadOnlyButton().focus();
    cy.press(Cypress.Keyboard.Keys.TAB);
    CollectionPage.getItemDialogSaveButton().should('have.focus');
    CollectionPage.getItemDialogSaveLabel().should('be.visible');
  });

  it('edits the title of an existing item and persists the change', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('updateItem');
    cy.on('window:confirm', () => true);

    // Open the item dialog
    CollectionPage.getListItemImages().first().click();

    // Enter edit mode
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();

    // Change the title
    CollectionPage.getItemDialogTitleInput().clear().type('Updated Title');

    // Save changes
    CollectionPage.getItemDialogSaveButton().click();

    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);

    // Verify the dialog shows the updated title in read-only mode
    cy.getByTestId('item-dialog-title').should('not.exist');
    cy.contains('Updated Title').should('be.visible');

    // Close dialog and verify list shows updated title
    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getListItems().should('contain.text', 'Updated Title');
  });

  it('edits multiple fields and persists the changes', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogYearInput().clear().type('2025');
    CollectionPage.getItemDialogGenreInput().clear().type('Drama, Comedy');
    CollectionPage.getItemDialogTagsInput().clear().type('#updated');
    CollectionPage.getItemDialogActorsInput().clear().type('New Actor One, New Actor Two');
    CollectionPage.getItemDialogPlotInput().clear().type('An updated plot for testing.');

    CollectionPage.getItemDialogSaveButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);

    // Verify persisted values in read-only mode
    cy.contains('2025').should('be.visible');
    cy.contains('Drama').should('be.visible');
    cy.contains('Comedy').should('be.visible');
    cy.contains('#updated').should('be.visible');
    cy.contains('New Actor One, New Actor Two').should('be.visible');
    cy.contains('An updated plot for testing.').scrollIntoView().should('be.visible');
  });

  it('edits the user rate and persists the change', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogUserRateInput().type('9.4');
    CollectionPage.getItemDialogSaveButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);

    CollectionPage.getItemDialogUserRateChip().should('contain.text', '9.4');
    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.setListPreferredRatingToUser();
    CollectionPage.visit();
    CollectionPage.getListItemUserRates().should('contain.text', '9.4');
  });

  it('clears an existing user rate', () => {
    cy.intercept('PUT', '/api/v1/collection-items/**').as('updateItem');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogUserRateInput().type('9.4');
    CollectionPage.getItemDialogSaveButton().click();
    cy.wait('@updateItem');

    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();
    CollectionPage.getItemDialogUserRateInput().clear();
    CollectionPage.getItemDialogSaveButton().click();
    cy.wait('@updateItem').its('response.statusCode').should('eq', 200);

    CollectionPage.getItemDialogUserRateChip().should('not.exist');
    CollectionPage.closeActiveDialogByOverlay();
    CollectionPage.getListItemUserRates().should('not.exist');
  });

  it('keeps save disabled for an invalid edited user rate', () => {
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogUserRateInput().type('8.75');
    CollectionPage.getItemDialogSaveButton().should('be.disabled');
  });

  it('keeps save disabled for invalid edited external rating formats', () => {
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogIMDbRateInput().clear().type('10.1');
    CollectionPage.getItemDialogSaveButton().should('be.disabled');

    CollectionPage.getItemDialogIMDbRateInput().clear().type('10');
    CollectionPage.getItemDialogRottenTomatoesRateInput().type('101%');
    CollectionPage.getItemDialogSaveButton().should('be.disabled');

    CollectionPage.getItemDialogRottenTomatoesRateInput().clear().type('100%');
    CollectionPage.getItemDialogMetacriticRateInput().type('59%');
    CollectionPage.getItemDialogSaveButton().should('be.disabled');
  });

  it('discards draft changes when read-only is clicked', () => {
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogTitleInput().clear().type('Discarded Title');

    // Click read-only to discard
    cy.getByTestId('item-dialog-read-only').click();

    // Verify original title remains and discarded title is gone
    cy.contains('Edit Test Movie').should('be.visible');
    cy.contains('Discarded Title').should('not.exist');
  });
});

describe('Item dialog — tag autocomplete', () => {
  const tags = ['#bluary', '#english-cover', '#season01', '#season02', '#season03', '#season04', '#season05'];
  const item = { ...buildCollectionItem('Tag Suggestion Movie', 'movie', 'tt7000002'), tags };

  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/collection-items', item);
    CollectionPage.visit();
  });

  it('shows three later suggestions when earlier matches are already selected', () => {
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEditButton().click();

    CollectionPage.getItemDialogTagsInput().clear().type('#bluary #english-cover #season01 #season02 #');

    CollectionPage.getItemDialogTagSuggestions().should('have.length', 3).and('contain.text', '#season03');
  });
});

describe('Item dialog — external links', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/collection-items', buildCollectionItem('Link Test Movie', 'movie', 'tt7000003'));
    CollectionPage.visit();
  });

  it('shows the YouTube trailer link with the correct href', () => {
    CollectionPage.getListItemImages().first().click();

    cy.getByTestId('video')
      .should('have.attr', 'href')
      .and('include', 'youtube.com')
      .and('include', 'Link%20Test%20Movie');
  });

  it('shows the web search link with the correct href', () => {
    CollectionPage.getListItemImages().first().click();

    cy.getByTestId('about-web-search-link')
      .should('have.attr', 'href')
      .and('include', 'duckduckgo.com')
      .and('include', 'Link%20Test%20Movie');
  });
});

describe('Item dialog — mark watched / unwatched', () => {
  beforeEach(() => {
    cy.autoLogin();
    cy.request('POST', '/api/v1/collection-items', buildCollectionItem('Watch Test Movie', 'movie', 'tt7000002'));
    CollectionPage.visit();
  });

  it('marks an unwatched item as watched', () => {
    cy.intercept('POST', '/api/v1/collection-items/*/*/tracking*').as('markWatched');
    cy.on('window:confirm', () => true);

    CollectionPage.getListItemImages().first().click();

    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMarkFinishedButton().click();
    cy.wait('@markWatched').its('response.statusCode').should('eq', 200);

    // After marking watched, the button should switch to mark-unwatched
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMarkUnfinishedButton().should('be.visible');
  });

  it('marks a watched item as unwatched', () => {
    cy.intercept('POST', '/api/v1/collection-items/*/*/tracking*').as('markWatched');
    cy.intercept('DELETE', '/api/v1/collection-items/*/*/tracking/completed*').as('markUnwatched');
    cy.on('window:confirm', () => true);

    // First mark as watched
    CollectionPage.getListItemImages().first().click();
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMarkFinishedButton().click();
    cy.wait('@markWatched');

    // Now mark as unwatched
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMarkUnfinishedButton().click();
    cy.wait('@markUnwatched').its('response.statusCode').should('eq', 204);

    // Button should switch back to mark-watched
    CollectionPage.expectItemDialogActionsVisible();
    CollectionPage.getItemDialogMarkFinishedButton().should('be.visible');
  });
});
