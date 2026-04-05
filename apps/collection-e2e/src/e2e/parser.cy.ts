import { buildOmdbItem, buildOmdbSearchResult } from '../fixtures/omdb';
import { CollectionPage } from '../page-objects/collection.po';
import { CommonPage } from '../page-objects/common.po';
import { ParserPage } from '../page-objects/parser.po';

// Parser tests use a fresh user so that saving parser config does not affect
// the shared cypress user and does not interfere with other specs.

describe('Parser — page loads with default config', () => {
  beforeEach(() => {
    cy.autoLoginWithNewUser();
    ParserPage.visit();
  });

  it('shows the md template textarea with a non-empty default value', () => {
    ParserPage.getMdTemplateTextarea().should('be.visible').and('not.have.value', '');
  });

  it('shows the filename pattern input with a non-empty default value', () => {
    ParserPage.getFilenamePatternInput().should('be.visible').and('not.have.value', '');
  });

  // Regexp inputs live inside a scrollable .main-body container. Cypress
  // visibility checks are unreliable with nested overflow parents even after
  // scrollIntoView, so we assert existence + value only.
  it('shows the IMDb ID regexp input with a non-empty default value', () => {
    ParserPage.getImdbIdInput().should('exist').and('not.have.value', '');
  });

  it('shows the genre regexp input with a non-empty default value', () => {
    ParserPage.getGenreInput().should('exist').and('not.have.value', '');
  });

  it('shows the genre token regexp input with a non-empty default value', () => {
    ParserPage.getGenreTokenInput().should('exist').and('not.have.value', '');
  });

  it('shows the image regexp input with a non-empty default value', () => {
    ParserPage.getImageInput().should('exist').and('not.have.value', '');
  });

  it('shows the IMDb rate regexp input with a non-empty default value', () => {
    ParserPage.getImdbRateInput().should('exist').and('not.have.value', '');
  });

  it('shows the tags regexp input with a non-empty default value', () => {
    ParserPage.getTagsInput().should('exist').and('not.have.value', '');
  });

  it('shows the tag token regexp input with a non-empty default value', () => {
    ParserPage.getTagTokenInput().should('exist').and('not.have.value', '');
  });

  it('shows the title regexp input with a non-empty default value', () => {
    ParserPage.getTitleInput().should('exist').and('not.have.value', '');
  });

  it('shows the year regexp input with a non-empty default value', () => {
    ParserPage.getYearInput().should('exist').and('not.have.value', '');
  });

  it('shows the content regexp input with a non-empty default value', () => {
    ParserPage.getContentInput().should('exist').and('not.have.value', '');
  });

  it('the save button is enabled when the form is valid', () => {
    ParserPage.getSaveButton().should('not.be.disabled');
  });

  it('the preview button is enabled when the form is valid', () => {
    ParserPage.getPreviewButton().should('not.be.disabled');
  });

  it('the refresh start button is enabled when the form is valid', () => {
    ParserPage.getRefreshStartButton().should('not.be.disabled');
  });
});

describe('Parser — navigate via menu', () => {
  beforeEach(() => {
    cy.autoLoginWithNewUser();
  });

  it('opens the parser page from the navigation menu', () => {
    CommonPage.navigateToParserViaMenu();
    cy.url().should('include', '#/parser');
    ParserPage.getSaveButton().should('be.visible');
  });

  it('shows the parser nav link in the menu', () => {
    CommonPage.openMenu();
    CommonPage.getNavParserLink().should('be.visible');
  });
});

describe('Parser — save configuration', () => {
  beforeEach(() => {
    cy.autoLoginWithNewUser();
    ParserPage.visit();
  });

  it('calls POST /api/v1/parser/change-config when save is clicked', () => {
    cy.intercept('POST', '/api/v1/parser/change-config').as('saveConfig');

    ParserPage.getSaveButton().click();

    cy.wait('@saveConfig').its('response.statusCode').should('eq', 200);
  });

  it('persists a changed filename pattern after save', () => {
    cy.intercept('POST', '/api/v1/parser/change-config').as('saveConfig');

    ParserPage.getFilenamePatternInput().clear().type('{{Year}}-{{Title}}.md', { parseSpecialCharSequences: false });
    ParserPage.getSaveButton().click();

    cy.wait('@saveConfig').its('request.body.filenamePattern').should('eq', '{{Year}}-{{Title}}.md');
  });

  it('persists a changed md template after save', () => {
    cy.intercept('POST', '/api/v1/parser/change-config').as('saveConfig');

    // The template must include all 13 required keys or the form becomes invalid.
    const newTemplate = [
      '### {{Title}}',
      '{{imdbID}} {{imdbRating}} {{Plot}} {{Poster}} {{Year}}',
      '{{Director}} {{Genre}} {{Actors}}',
      '{{YoutubeQuery}} {{WebQuery}}',
      '**Tags** #{{Type}} {{Tags}}',
    ].join('\n');
    ParserPage.getMdTemplateTextarea().clear().type(newTemplate, { delay: 0, parseSpecialCharSequences: false });
    ParserPage.getSaveButton().click();

    cy.wait('@saveConfig').its('response.statusCode').should('eq', 200);
  });
});

describe('Parser — modified configuration persists across page reload', () => {
  beforeEach(() => {
    cy.autoLoginWithNewUser();
    ParserPage.visit();
  });

  it('reloads the saved filename pattern after navigating away and back', () => {
    cy.intercept('POST', '/api/v1/parser/change-config').as('saveConfig');

    ParserPage.getFilenamePatternInput().clear().type('{{Year}}-{{Title}}.md', { parseSpecialCharSequences: false });
    ParserPage.getSaveButton().click();
    cy.wait('@saveConfig');

    // Navigate away and back
    cy.visit('/client/#/collection');
    ParserPage.visit();

    ParserPage.getFilenamePatternInput().should('have.value', '{{Year}}-{{Title}}.md');
  });
});

describe('Parser — preview generation', () => {
  beforeEach(() => {
    cy.autoLoginWithNewUser();
    ParserPage.visit();
  });

  it('clicking preview opens a window alert', () => {
    const alertStub = cy.stub();
    cy.on('window:alert', alertStub);

    ParserPage.getPreviewButton().click();

    cy.then(() => {
      expect(alertStub).to.have.been.called;
    });
  });
});

describe('Parser — refresh templates', () => {
  beforeEach(() => {
    cy.autoLoginWithNewUser();
    ParserPage.visit();
  });

  it('clicking refresh start triggers window.confirm', () => {
    const confirmStub = cy.stub().returns(false);
    cy.on('window:confirm', confirmStub);

    ParserPage.getRefreshStartButton().click();

    cy.then(() => {
      expect(confirmStub).to.have.been.called;
    });
  });
});

describe('Parser — custom template applied to new collection item', () => {
  const movieTitle = 'Custom Template Movie';

  const customTemplate = [
    '# {{Title}} ({{Year}})',
    '[IMDb ({{imdbID}})](https://www.imdb.com/title/{{imdbID}}/) (**{{imdbRating}}** / 10)',
    '{{Plot}}',
    '![poster|90]({{Poster}})',
    'CUSTOM-DIR: {{Director}}',
    'CUSTOM-GENRE: {{Genre}}',
    'CUSTOM-CAST: {{Actors}}',
    '[Trailer](https://www.youtube.com/results?search_query={{YoutubeQuery}})',
    '[Web](https://duckduckgo.com/?q={{WebQuery}})',
    '**Tags** #{{Type}} {{Tags}}',
  ].join('\n');

  beforeEach(() => {
    cy.autoLoginWithNewUser();

    // Fetch the default config, override mdTemplate, and save
    cy.request('GET', '/api/v1/parser/config').then((response) => {
      cy.request('POST', '/api/v1/parser/change-config', {
        ...(response.body as Record<string, string>),
        mdTemplate: customTemplate,
      });
    });

    // Mock OMDB proxy endpoints
    cy.intercept('GET', '/api/v1/proxy/omdb/search*', {
      statusCode: 200,
      body: buildOmdbSearchResult(movieTitle),
    }).as('omdbSearch');
    cy.intercept('GET', '/api/v1/proxy/omdb/item*', {
      statusCode: 200,
      body: buildOmdbItem(movieTitle),
    }).as('omdbItem');
    cy.intercept('POST', '/api/v1/create').as('createItem');

    // Reload so preloadUserParserConfig picks up the custom template
    CollectionPage.visit();
  });

  it('generates item content from the custom template and displays it in edit mode', () => {
    // Add a new item via OMDB search
    CollectionPage.getShowFunctionsButton().click();
    CollectionPage.getAddNewButton().click();
    CollectionPage.getNewItemSearchInput().type(movieTitle);
    cy.wait('@omdbSearch');
    CollectionPage.getNewItemContentSelect().find('option').should('have.length.at.least', 1);
    CollectionPage.getNewItemSaveButton().click();

    // Verify the create API received content from the custom template
    cy.wait('@createItem').then((interception) => {
      const content = (interception.request.body as { content: string }).content;
      expect(content).to.contain(`# ${movieTitle} (2020)`);
      expect(content).to.contain('CUSTOM-DIR: Test Director');
      expect(content).to.contain('CUSTOM-GENRE: Action, Adventure');
      expect(content).to.contain('CUSTOM-CAST: Actor One, Actor Two');
    });

    // Reload the collection page to close all dialogs and see the persisted item
    CollectionPage.visit();

    // Open the created item dialog and switch to edit mode
    CollectionPage.getListItemImages().first().click();
    CollectionPage.getItemDialogEditButton().click();

    // Verify the raw content in the CodeMirror editor matches the custom template
    CollectionPage.getItemDialogEditorContent().should('contain.text', `# ${movieTitle} (2020)`);
    CollectionPage.getItemDialogEditorContent().should('contain.text', 'CUSTOM-DIR: Test Director');
    CollectionPage.getItemDialogEditorContent().should('contain.text', 'CUSTOM-GENRE: Action, Adventure');
    CollectionPage.getItemDialogEditorContent().should('contain.text', 'CUSTOM-CAST: Actor One, Actor Two');
  });
});
