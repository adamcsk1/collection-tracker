import { signal } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { createFormControlA11y } from './form-control-a11y-util';

function makeError(kind: string): ValidationError.WithOptionalFieldTree {
  return { kind } as ValidationError.WithOptionalFieldTree;
}

function setup(overrides: {
  elementId?: string;
  hint?: string | undefined;
  touched?: boolean;
  dirty?: boolean;
  errors?: ValidationError.WithOptionalFieldTree[];
}) {
  const elementId = signal(overrides.elementId ?? 'field-id');
  const hint = signal<string | undefined>(overrides.hint);
  const touched = signal(overrides.touched ?? false);
  const dirty = signal(overrides.dirty ?? false);
  const errors = signal<readonly ValidationError.WithOptionalFieldTree[]>(overrides.errors ?? []);
  const a11y = createFormControlA11y(elementId, hint, touched, dirty, errors);
  return { elementId, hint, touched, dirty, errors, ...a11y };
}

describe('createFormControlA11y', () => {
  describe('showError', () => {
    it('is false when neither touched nor dirty', () => {
      const { showError } = setup({ errors: [makeError('required')] });
      expect(showError()).toBe(false);
    });

    it('is false when touched but no errors', () => {
      const { showError } = setup({ touched: true });
      expect(showError()).toBe(false);
    });

    it('is false when dirty but no errors', () => {
      const { showError } = setup({ dirty: true });
      expect(showError()).toBe(false);
    });

    it('is true when touched with errors', () => {
      const { showError } = setup({ touched: true, errors: [makeError('required')] });
      expect(showError()).toBe(true);
    });

    it('is true when dirty with errors', () => {
      const { showError } = setup({ dirty: true, errors: [makeError('minlength')] });
      expect(showError()).toBe(true);
    });

    it('reacts to touched changing', () => {
      const { touched, showError } = setup({ errors: [makeError('required')] });
      expect(showError()).toBe(false);
      touched.set(true);
      expect(showError()).toBe(true);
    });
  });

  describe('hintId', () => {
    it('is null when hint is undefined', () => {
      const { hintId } = setup({});
      expect(hintId()).toBeNull();
    });

    it('returns elementId-hint when hint is provided', () => {
      const { hintId } = setup({ elementId: 'my-input', hint: 'Some hint' });
      expect(hintId()).toBe('my-input-hint');
    });

    it('reacts to hint changing', () => {
      const { hint, hintId } = setup({ elementId: 'el' });
      expect(hintId()).toBeNull();
      hint.set('now there is a hint');
      expect(hintId()).toBe('el-hint');
    });
  });

  describe('errorId', () => {
    it('is null when error is not shown', () => {
      const { errorId } = setup({});
      expect(errorId()).toBeNull();
    });

    it('returns elementId-error when error is shown', () => {
      const { errorId } = setup({ elementId: 'my-input', touched: true, errors: [makeError('required')] });
      expect(errorId()).toBe('my-input-error');
    });

    it('is null when errors present but not touched or dirty', () => {
      const { errorId } = setup({ errors: [makeError('required')] });
      expect(errorId()).toBeNull();
    });
  });

  describe('describedBy', () => {
    it('is null when no hint and no errors shown', () => {
      const { describedBy } = setup({});
      expect(describedBy()).toBeNull();
    });

    it('contains only hintId when hint present but no errors shown', () => {
      const { describedBy, hintId } = setup({ hint: 'A hint' });
      expect(describedBy()).toBe(hintId());
    });

    it('contains only errorId when error shown but no hint', () => {
      const { describedBy, errorId } = setup({ touched: true, errors: [makeError('required')] });
      expect(describedBy()).toBe(errorId());
    });

    it('combines hintId and errorId when both are present', () => {
      const { describedBy, hintId, errorId } = setup({
        hint: 'A hint',
        touched: true,
        errors: [makeError('required')],
      });
      expect(describedBy()).toBe(`${hintId()} ${errorId()}`);
    });
  });

  describe('hasRequiredError', () => {
    it('is false when error is not shown', () => {
      const { hasRequiredError } = setup({ errors: [makeError('required')] });
      expect(hasRequiredError()).toBe(false);
    });

    it('is false when error is shown but not a required error', () => {
      const { hasRequiredError } = setup({ touched: true, errors: [makeError('minlength')] });
      expect(hasRequiredError()).toBe(false);
    });

    it('is true when error is shown and kind is required', () => {
      const { hasRequiredError } = setup({ touched: true, errors: [makeError('required')] });
      expect(hasRequiredError()).toBe(true);
    });

    it('is true when one of multiple errors is required', () => {
      const { hasRequiredError } = setup({
        dirty: true,
        errors: [makeError('minlength'), makeError('required')],
      });
      expect(hasRequiredError()).toBe(true);
    });
  });
});
