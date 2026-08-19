import '@analogjs/vitest-angular/setup-snapshots';
import '@angular/compiler';

import { provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach } from 'vitest';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

beforeEach(() => getTestBed().configureTestingModule({ providers: [provideZonelessChangeDetection()] }));
afterEach(() => getTestBed().resetTestingModule());
