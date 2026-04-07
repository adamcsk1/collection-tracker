import '@analogjs/vitest-angular/setup-snapshots';
import '@angular/compiler';

import { NgModule, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach } from 'vitest';

@NgModule({ providers: [provideZonelessChangeDetection()] })
class ZonelessTestModule {}

getTestBed().initTestEnvironment([BrowserTestingModule, ZonelessTestModule], platformBrowserTesting());

beforeEach(() => getTestBed().resetTestingModule());
afterEach(() => getTestBed().resetTestingModule());
