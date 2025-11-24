import { FormArray, FormControl, FormGroup } from '@angular/forms';

export type Form<T> = Required<{
  [K in keyof T]: T[K] extends Array<infer U>
    ? FormArray<FormGroup<{ [P in keyof U]: FormControl<U[P]> }>>
    : FormControl<T[K]>;
}>;
