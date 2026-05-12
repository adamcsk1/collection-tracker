import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, minLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { SignInModel } from './sign-in-model';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { SharedApiService } from '@services/api/shared-api-service';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { companionApp, resetCompanionAppConfig } from '@shared/utils/companion-app-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, firstValueFrom, of } from 'rxjs';

@Component({
  selector: 'lo-sign-in',
  imports: [Input, FormField, FormRoot, RouterLink, Select],
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
  protected readonly translations = {
    welcomeBack: computed(() => this.ngxSignalTranslate.translate('WelcomeBack')),
    messageSignIn: computed(() => this.ngxSignalTranslate.translate('Message.SignIn')),
    signIn: computed(() => this.ngxSignalTranslate.translate('SignIn')),
    username: computed(() => this.ngxSignalTranslate.translate('Username')),
    validationUsernameMinLength: computed(() => this.ngxSignalTranslate.translate('Validation.UsernameMinLength')),
    validationUsernameMaxLength: computed(() => this.ngxSignalTranslate.translate('Validation.UsernameMaxLength')),
    secret: computed(() => this.ngxSignalTranslate.translate('Secret')),
    apiUrl: computed(() => this.ngxSignalTranslate.translate('ApiUrl')),
    messageApiUrl: computed(() => this.ngxSignalTranslate.translate('Message.ApiUrl')),
    continue: computed(() => this.ngxSignalTranslate.translate('Continue')),
    signUp: computed(() => this.ngxSignalTranslate.translate('SignUp')),
    companionAppReset: computed(() => this.ngxSignalTranslate.translate('CompanionAppReset')),
    changeApiUrl: computed(() => this.ngxSignalTranslate.translate('ChangeApiUrl')),
    language: computed(() => this.ngxSignalTranslate.translate('Language')),
    theme: computed(() => this.ngxSignalTranslate.translate('Theme')),
    toggleSecretAriaLabel: computed(() =>
      this.ngxSignalTranslate.translate(this.tokenInputType() === 'text' ? 'HideSecret' : 'ShowSecret')
    ),
    toggleSecretLabel: computed(() =>
      this.ngxSignalTranslate.translate(this.tokenInputType() === 'text' ? 'ShowSecret' : 'HideSecret')
    ),
  };
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
    }
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
        .pipe(catchError(() => of(void 0)))
    );
    window.location.href = `${getBasePath()}/client/`;
  }

  protected onResetCompanionAppConfig(): void {
    resetCompanionAppConfig();
  }
}
