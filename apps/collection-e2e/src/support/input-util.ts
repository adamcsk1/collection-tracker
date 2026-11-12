import { expect, type Locator } from '@playwright/test';

export const fillAutocomplete = async (input: Locator, text: string): Promise<void> => {
  await input.fill(text);
  // Autocomplete commits its value on keyup, not on the input event emitted by fill.
  await input.dispatchEvent('keyup');
  await expect(input).toHaveValue(text);
};
