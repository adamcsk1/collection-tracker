import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Input } from '@components/input/input';
import { SignUpModel } from '@login/sign-up/sign-up-model';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { Form } from '@shared/models/form-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'lo-sign-up',
  imports: [NgxSignalTranslatePipe, Input, ReactiveFormsModule, RouterLink],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.css',
})
export class SignUp implements OnInit {
  private readonly apiState = inject(apiStateToken);
  private readonly webStorage = inject(WebstorageService);
  private readonly api = inject(ApiService);
  protected readonly formGroup = new FormGroup<Form<SignUpModel>>({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apiUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly showApiUrlInput = signal(false);
  protected readonly secret = signal('TODO TODO TODO TODO ');

  public ngOnInit(): void {
    this.formGroup.patchValue({
      username: '',
      apiUrl: this.apiState.state.apiUrl() || '',
    });
  }

  protected onSend(): void {
    if (this.apiState.state.apiUrl() !== this.formGroup.value.apiUrl) {
      this.apiState.setState('apiUrl', `${this.formGroup.value.apiUrl}`);
      this.webStorage.setItem(STORAGE_API_URL, this.apiState.state.apiUrl());
    }

    /*this.api.signUp(`${this.formGroup.value.username}`).subscribe((response) => {
      console.log(response);
    });*/
  }

  protected onCopyToClipboard(): void {}
}
