import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, maxLength, minLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Input } from '@components/input/input';
import { toastStateToken } from '@components/toast/toast-store';
import { SignUpModel } from '@login/sign-up/sign-up-model';
import { apiStateToken } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { copyToClipboard } from '@shared/utils/copy-to-clipboard-util';
import { mobileUserAgent } from '@shared/utils/mobile-user-agent.util';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'lo-sign-up',
  imports: [NgxSignalTranslatePipe, Input, FormField, FormRoot, RouterLink],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUp implements OnInit {
  private readonly apiState = inject(apiStateToken);
  private readonly webStorage = inject(WebstorageService);
  private readonly api = inject(PublicApiService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly toastState = inject(toastStateToken);
  protected readonly signUpModel = signal<SignUpModel>({
    username: '',
    apiUrl: '',
  });
  protected readonly form = form(
    this.signUpModel,
    (signUp) => {
      required(signUp.username);
      minLength(signUp.username, 3);
      maxLength(signUp.username, 32);
      required(signUp.apiUrl);
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
  protected readonly secret = signal('');

  public ngOnInit(): void {
    this.signUpModel.set({
      username: '',
      apiUrl: this.apiState.state.apiUrl() || '',
    });
  }

  protected onCopyToClipboard(): void {
    copyToClipboard(this.secret());
    if (!mobileUserAgent()) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.CopiedToClipboard'));
    }
  }

  private async onSend(): Promise<void> {
    const formValue = this.signUpModel();

    if (this.apiState.state.apiUrl() !== formValue.apiUrl) {
      this.apiState.setState('apiUrl', formValue.apiUrl);
      this.webStorage.setItem(STORAGE_API_URL, this.apiState.state.apiUrl());
    }

    const response = await firstValueFrom(this.api.signUp(formValue.username));
    this.secret.set(response.token);
  }
}
