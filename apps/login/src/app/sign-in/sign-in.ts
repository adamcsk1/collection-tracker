import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Input } from '@components/input/input';
import { Select } from '@components/select/select';
import { SignInModel } from '@login/sign-in/sign-in-model';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { Themes } from '@services/theme/theme-model';
import { ThemeService } from '@services/theme/theme-service';
import { themeStateToken } from '@services/theme/theme-store';
import { TranslateService } from '@services/translate-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL, STORAGE_LANGUAGE, STORAGE_THEME } from '@shared/constants/storage-const';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'lo-sign-in',
  imports: [NgxSignalTranslatePipe, Input, ReactiveFormsModule, RouterLink, Select],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn implements OnInit {
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly webStorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly translate = inject(TranslateService);
  private readonly themeState = inject(themeStateToken);
  private readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);
  protected readonly formGroup = new FormGroup<Form<SignInModel>>({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(32)],
    }),
    token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apiUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    language: new FormControl('en', { nonNullable: true, validators: [Validators.required] }),
    theme: new FormControl('light', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly showApiUrlInput = signal(false);
  protected readonly tokenInputType = signal<'text' | 'password'>('password');
  protected readonly themeOptions = this.theme.themeOptions;
  protected readonly languageOptions = this.translate.languageOptions;

  public ngOnInit(): void {
    this.formGroup.patchValue({
      username: '',
      token: '',
      apiUrl: this.apiState.state.apiUrl() || '',
      language: this.webStorage.getItem(STORAGE_LANGUAGE) || 'en',
      theme: (this.webStorage.getItem(STORAGE_THEME) as Themes) || 'light',
    });

    this.formGroup.controls.language.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((language) => {
      this.webStorage.setItem(STORAGE_LANGUAGE, language);
      this.ngxSignalTranslate.setLanguage(language);
    });
    this.formGroup.controls.theme.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((theme) => {
      this.webStorage.setItem(STORAGE_THEME, theme);
      this.themeState.setState('theme', theme);
    });
  }

  protected onToggleTokenInputType(): void {
    this.tokenInputType.set(this.tokenInputType() === 'text' ? 'password' : 'text');
  }

  protected onSend(): void {
    if (this.apiState.state.apiUrl() !== this.formGroup.value.apiUrl) {
      this.apiState.setState('apiUrl', `${this.formGroup.value.apiUrl}`);
      this.webStorage.setItem(STORAGE_API_URL, this.apiState.state.apiUrl());
    }

    this.api
      .signIn(`${this.formGroup.value.username}`, `${this.formGroup.value.token}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => (window.location.href = '/client/'));
  }
}
