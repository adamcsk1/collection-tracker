import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ParserModel } from '@client/parser/parser-model';
import { ParserService } from '@client/parser/parser-service';
import { TemplateRegenerationService } from '@client/parser/template-regeneration-service';
import { mdTemplateValidator } from '@client/parser/validators/md-template-validator';
import { Details } from '@components/details/details';
import { Input } from '@components/input/input';
import { Textarea } from '@components/textarea/textarea';
import { apiStateToken } from '@services/api/api-store';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { getParserRegexp, getParserTemplate } from '@services/parser/parser-util';
import { Form } from '@shared/models/form-model';
import { serializeParserRegexp } from '@shared/utils/parser-serialize-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-parser',
  imports: [ReactiveFormsModule, NgxSignalTranslatePipe, Textarea, Input, Details],
  templateUrl: './parser.html',
  providers: [ParserService, TemplateRegenerationService, MdContentGeneratorService, OMDbService],
  host: {
    class: 'page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Parser implements OnInit {
  private readonly apiState = inject(apiStateToken);
  private readonly parser = inject(ParserService);
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly formGroup = new FormGroup<Form<ParserModel>>({
    IMDbId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    genre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    genreToken: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    image: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    IMDbRate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tags: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tagToken: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    year: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    mdTemplate: new FormControl('', { nonNullable: true, validators: [Validators.required, mdTemplateValidator()] }),
  });

  public ngOnInit(): void {
    this.formGroup.setValue({
      IMDbId: serializeParserRegexp(getParserRegexp('IMDbId')),
      genre: serializeParserRegexp(getParserRegexp('genre')),
      genreToken: serializeParserRegexp(getParserRegexp('genreToken')),
      image: serializeParserRegexp(getParserRegexp('image')),
      IMDbRate: serializeParserRegexp(getParserRegexp('IMDbRate')),
      tags: serializeParserRegexp(getParserRegexp('tags')),
      tagToken: serializeParserRegexp(getParserRegexp('tagToken')),
      title: serializeParserRegexp(getParserRegexp('title')),
      year: serializeParserRegexp(getParserRegexp('year')),
      mdTemplate: getParserTemplate(),
    });
  }

  protected onSave(): void {
    this.parser.storeFormData(this.formGroup.value);
  }

  protected onGeneratePreview(): void {
    this.parser.generatePreviewContent(this.formGroup.value);
  }

  protected onRefreshTemplates(): void {
    this.parser.regenerateTemplates();
  }
}
