import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, minLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { SignInModel } from '@login/sign-in/sign-in-model';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { SharedApiService } from '@services/api/shared-api-service';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { companionApp, resetCompanionAppConfig } from '@shared/utils/companion-app-util';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, firstValueFrom, of } from 'rxjs';

@Component({
  selector: 'lo-sign-in',
  imports: [NgxSignalTranslatePipe, Input, FormField, FormRoot, RouterLink, Select],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn implements OnInit {
  private readonly apiState = inject(apiStateToken);
  private readonly webStorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly translate = inject(TranslateService);
  private readonly themeState = inject(themeStateToken);
  private readonly theme = inject(ThemeService);
  private readonly publicApi = inject(PublicApiService);
  private readonly sharedApi = inject(SharedApiService);
  protected readonly signInModel = signal<SignInModel>({
    username: '',
    token: '',
    apiUrl: '',
    language: 'en',
    theme: 'light',
  });
  protected readonly form = form(
    this.signInModel,
    (signIn) => {
      required(signIn.username);
      minLength(signIn.username, 3);
      maxLength(signIn.username, 32);
      required(signIn.token);
      required(signIn.apiUrl);
      required(signIn.language);
      required(signIn.theme);
    },
    {
      submission: {
        action: async () => this.onSend(),
      },
    },
  );
  protected readonly formErrors = {
    username: {
      minLength: computed(() =>
        this.form
          .username()
          .errors()
          .some((error) => error.kind === 'minLength')
      ),
      maxLength: computed(() =>
        this.form
          .username()
          .errors()
          .some((error) => error.kind === 'maxLength')
      ),
    },
  };
  protected readonly showApiUrlInput = signal(false);
  protected readonly tokenInputType = signal<'text' | 'password'>('password');
  protected readonly themeOptions = this.theme.themeOptions;
  protected readonly languageOptions = this.translate.languageOptions;
  protected readonly companionAppDetected = companionApp();

  constructor() {
    effect(() => {
      const language = this.form.language().value();
      this.ngxSignalTranslate.setLanguage(language);
    });

    effect(() => {
      const theme = this.form.theme().value();
      this.themeState.setState('theme', theme);
    });
  }

  public ngOnInit(): void {
    this.signInModel.set({
      username: '',
      token: '',
      apiUrl: this.apiState.state.apiUrl() || '',
      language: 'en',
      theme: 'light',
    });
  }

  protected onToggleTokenInputType(): void {
    this.tokenInputType.set(this.tokenInputType() === 'text' ? 'password' : 'text');
  }

  private async onSend(): Promise<void> {
    const formValue = this.signInModel();

    if (this.apiState.state.apiUrl() !== formValue.apiUrl) {
      this.apiState.setState('apiUrl', formValue.apiUrl);
      this.webStorage.setItem(STORAGE_API_URL, this.apiState.state.apiUrl());
    }

    await firstValueFrom(this.publicApi.signIn(formValue.username, formValue.token));
    await firstValueFrom(
      this.sharedApi
        .updateUserSettings({
          language: formValue.language,
          theme: formValue.theme,
        })
        .pipe(catchError(() => of(void 0))),
    );
    window.location.href = '/client/';
  }

  protected onResetCompanionAppConfig(): void {
    resetCompanionAppConfig();
  }
}
