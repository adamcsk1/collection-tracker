export const TagManagementPage = {
  visit: () => {
    cy.visit('/client/#/settings/tag-management');
    cy.reload();
  },

  getResetButton: () => cy.getByTestId('tag-management-reset'),
  getList: () => cy.getByTestId('tag-management-list', { timeout: 10000 }),
  getColorButton: (tag: string) => cy.getByTestId(`tag-management-color-${tag}`),
  getWeightInput: (tag: string) => cy.getByTestId(`tag-management-weight-${tag}`).find('input'),
  getImageBorderCheckbox: (tag: string) =>
    cy.getByTestId(`tag-management-image-border-${tag}`).find('input[type="checkbox"]'),
  getTextColorCheckbox: (tag: string) => cy.getByTestId(`tag-management-text-color-${tag}`).find('input[type="checkbox"]'),
  getImageBadgeCheckbox: (tag: string) =>
    cy.getByTestId(`tag-management-image-badge-${tag}`).find('input[type="checkbox"]'),
};
