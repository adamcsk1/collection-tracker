import { AbstractControl, ValidatorFn } from '@angular/forms';

export const mdTemplateValidator = (): ValidatorFn => {
  return (control: AbstractControl) => {
    const missingKeys: string[] = [];
    if (!control.value.includes('{{Title}}')) {
      missingKeys.push('{{Title}}');
    }
    if (!control.value.includes('{{imdbID}}')) {
      missingKeys.push('{{imdbID}}');
    }
    if (!control.value.includes('{{imdbRating}}')) {
      missingKeys.push('{{imdbRating}}');
    }
    if (!control.value.includes('{{Plot}}')) {
      missingKeys.push('{{Plot}}');
    }
    if (!control.value.includes('{{Poster}}')) {
      missingKeys.push('{{Poster}}');
    }
    if (!control.value.includes('{{Year}}')) {
      missingKeys.push('{{Year}}');
    }
    if (!control.value.includes('{{Director}}')) {
      missingKeys.push('{{Director}}');
    }
    if (!control.value.includes('{{Genre}}')) {
      missingKeys.push('{{Genre}}');
    }
    if (!control.value.includes('{{Actors}}')) {
      missingKeys.push('{{Actors}}');
    }
    if (!control.value.includes('{{YoutubeQuery}}')) {
      missingKeys.push('{{YoutubeQuery}}');
    }
    if (!control.value.includes('{{WebQuery}}')) {
      missingKeys.push('{{WebQuery}}');
    }
    if (!control.value.includes('{{Type}}')) {
      missingKeys.push('{{Type}}');
    }
    if (!control.value.includes('{{Tags}}')) {
      missingKeys.push('{{Tags}}');
    }
    return missingKeys.length > 0 ? { mdTemplate: { missingKeys: missingKeys.join(', ') } } : null;
  };
};
