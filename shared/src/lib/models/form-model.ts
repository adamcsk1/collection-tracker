import { FormControl } from '@angular/forms';

export type Form<T> = Required<{
  [K in keyof T]: FormControl<T[K]>;
}>;
