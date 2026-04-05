export const ParserPage = {
  visit: () => {
    cy.visit('/client/#/parser');
  },

  // Main form fields
  getMdTemplateTextarea: () => cy.getByTestId('parser-md-template').find('textarea'),
  getFilenamePatternInput: () => cy.getByTestId('parser-filename-pattern').scrollIntoView().find('input'),

  // Regexp inputs (inside the collapsible TemplateRegexps details section)
  // Always scroll the inner <input> into view (not the host <libc-input>) so the
  // actual control is visible inside the .main-body overflow container.
  getImdbIdInput: () => cy.getByTestId('parser-imdb-id').find('input').scrollIntoView(),
  getGenreInput: () => cy.getByTestId('parser-genre').find('input').scrollIntoView(),
  getGenreTokenInput: () => cy.getByTestId('parser-genre-token').find('input').scrollIntoView(),
  getImageInput: () => cy.getByTestId('parser-image').find('input').scrollIntoView(),
  getImdbRateInput: () => cy.getByTestId('parser-imdb-rate').find('input').scrollIntoView(),
  getTagsInput: () => cy.getByTestId('parser-tags').find('input').scrollIntoView(),
  getTagTokenInput: () => cy.getByTestId('parser-tag-token').find('input').scrollIntoView(),
  getTitleInput: () => cy.getByTestId('parser-title').find('input').scrollIntoView(),
  getYearInput: () => cy.getByTestId('parser-year').find('input').scrollIntoView(),
  getContentInput: () => cy.getByTestId('parser-content').find('input').scrollIntoView(),

  // Action buttons
  getSaveButton: () => cy.getByTestId('parser-save').scrollIntoView(),
  getPreviewButton: () => cy.getByTestId('parser-preview').scrollIntoView(),
  getRefreshStartButton: () => cy.getByTestId('parser-refresh-start').scrollIntoView(),
};
