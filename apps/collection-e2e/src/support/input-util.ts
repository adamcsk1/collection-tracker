import { expect, type Locator } from '@playwright/test';

export const fillAutocomplete = async (input: Locator, text: string): Promise<void> => {
  await input.fill(text);
  await expect(input).toHaveValue(text);
};
