import { HttpContextToken } from '@angular/common/http';

export const redirectOnRefreshFailureContext = new HttpContextToken<boolean>(() => true);
