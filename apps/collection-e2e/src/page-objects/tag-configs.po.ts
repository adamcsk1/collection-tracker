export const TagConfigsPage = {
  visit: () => {
    cy.visit('/client/#/settings/tag-configs');
    cy.reload();
  },

  getResetButton: () => cy.getByTestId('tag-configs-reset'),
  getList: () => cy.getByTestId('tag-configs-list'),
  getColorButton: (tag: string) => cy.getByTestId(`tag-config-color-${tag}`),
  getWeightInput: (tag: string) => cy.getByTestId(`tag-config-weight-${tag}`).find('input'),
  getImageBorderCheckbox: (tag: string) => cy.getByTestId(`tag-config-image-border-${tag}`).find('input[type="checkbox"]'),
  getTextColorCheckbox: (tag: string) => cy.getByTestId(`tag-config-text-color-${tag}`).find('input[type="checkbox"]'),
  getImageBadgeCheckbox: (tag: string) => cy.getByTestId(`tag-config-image-badge-${tag}`).find('input[type="checkbox"]'),
};
