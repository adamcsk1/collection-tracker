import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Input } from '@components/input/input';
import { SignInModel } from '@login/sign-in/sign-in-model';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'lo-sign-in',
  imports: [NgxSignalTranslatePipe, Input, ReactiveFormsModule, RouterLink],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.css',
})
export class SignIn implements OnInit {
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly webStorage = inject(WebstorageService);
  private readonly api = inject(ApiService);
  protected readonly formGroup = new FormGroup<Form<SignInModel>>({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(32)],
    }),
    token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apiUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly showApiUrlInput = signal(false);
  protected readonly tokenInputType = signal<'text' | 'password'>('password');

  public ngOnInit(): void {
    this.formGroup.patchValue({
      username: '',
      token: '',
      apiUrl: this.apiState.state.apiUrl() || '',
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
