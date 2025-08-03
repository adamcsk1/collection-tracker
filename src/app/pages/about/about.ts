import { Component } from '@angular/core';
import { APP_VERSION, BUILD, BUILD_DATE } from '@appConst';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-about',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  protected readonly build = BUILD;
  protected readonly buildDate = BUILD_DATE;
  protected readonly appVersion = APP_VERSION;
}
