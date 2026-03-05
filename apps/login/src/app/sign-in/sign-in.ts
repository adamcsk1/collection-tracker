import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, minLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { SignInModel } from '@login/sign-in/sign-in-model';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { THEMES } from '@services/theme/theme-const';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL, STORAGE_LANGUAGE, STORAGE_THEME } from '@shared/constants/storage-const';
import { parseAllowedValue } from '@shared/utils/parse-allowed-value-util';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom } from 'rxjs';

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
  private readonly api = inject(ApiService);
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

  constructor() {
    effect(() => {
      const language = this.form.language().value();
      this.webStorage.setItem(STORAGE_LANGUAGE, language);
      this.ngxSignalTranslate.setLanguage(language);
    });

    effect(() => {
      const theme = this.form.theme().value();
      this.webStorage.setItem(STORAGE_THEME, theme);
      this.themeState.setState('theme', theme);
    });
  }

  public ngOnInit(): void {
    this.signInModel.set({
      username: '',
      token: '',
      apiUrl: this.apiState.state.apiUrl() || '',
      language: this.webStorage.getItem(STORAGE_LANGUAGE) || 'en',
      theme: parseAllowedValue(this.webStorage.getItem(STORAGE_THEME), THEMES) ?? 'light',
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

    await firstValueFrom(this.api.signIn(formValue.username, formValue.token));
    window.location.href = '/client/';
  }
}
