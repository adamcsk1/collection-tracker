import type { HttpContext } from '@angular/common/http';

export interface ApiRequestOptions {
  context?: HttpContext;
  suppressErrorAlert?: boolean;
}
