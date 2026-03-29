import { computed, Signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';

export const createFormControlA11y = (
  elementId: Signal<string>,
  hint: Signal<string | undefined>,
  touched: Signal<boolean>,
  dirty: Signal<boolean>,
  errors: Signal<readonly ValidationError.WithOptionalFieldTree[]>,
) => {
  const showError = computed(() => (touched() || dirty()) && errors().length > 0);
  const hintId = computed<string | null>(() => (hint() ? `${elementId()}-hint` : null));
  const errorId = computed<string | null>(() => (showError() ? `${elementId()}-error` : null));
  const describedBy = computed<string | null>(() => {
    const ids = [hintId(), errorId()].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });
  const hasRequiredError = computed(() => showError() && errors().some((error) => error.kind === 'required'));
  return { showError, hintId, errorId, describedBy, hasRequiredError };
};
