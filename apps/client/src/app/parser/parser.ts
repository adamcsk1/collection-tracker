import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, FormField, FormRoot, required, validate } from '@angular/forms/signals';
import { ParserModel } from '@client/parser/parser-model';
import { ParserService } from '@client/parser/parser-service';
import { TemplateRegenerationService } from '@client/parser/template-regeneration-service';
import {
  mdTemplateValidationError,
  type MdTemplateValidationError,
} from '@client/parser/validators/md-template-validator';
import { Details } from '@components/details/details';
import { Input } from '@components/input/input';
import { Textarea } from '@components/textarea/textarea';
import { apiStateToken } from '@services/api/api-store';
import { MdContentGeneratorService } from '@services/md-content-generator/md-content-generator-service';
import { OMDbService } from '@services/omdb/omdb-service';
import { getParserRegexp, getParserTemplate } from '@services/parser/parser-util';
import { serializeParserRegexp } from '@shared/utils/parser-serialize-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-parser',
  imports: [FormField, FormRoot, NgxSignalTranslatePipe, Textarea, Input, Details],
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
  protected readonly parserModel = signal<ParserModel>({
    IMDbId: '',
    genre: '',
    genreToken: '',
    image: '',
    IMDbRate: '',
    tags: '',
    tagToken: '',
    title: '',
    year: '',
    mdTemplate: '',
  });
  protected readonly form = form(
    this.parserModel,
    (parser) => {
      required(parser.IMDbId);
      required(parser.genre);
      required(parser.genreToken);
      required(parser.image);
      required(parser.IMDbRate);
      required(parser.tags);
      required(parser.tagToken);
      required(parser.title);
      required(parser.year);
      required(parser.mdTemplate);
      validate(parser.mdTemplate, ({ value }) => mdTemplateValidationError(value()));
    },
    {
      submission: {
        action: async () => this.onSave(),
      },
    }
  );
  protected readonly mdTemplateError = computed<MdTemplateValidationError | undefined>(() => {
    return this.form
      .mdTemplate()
      .errors()
      .find((error) => error.kind === 'mdTemplate') as MdTemplateValidationError | undefined;
  });

  public ngOnInit(): void {
    this.parserModel.set({
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

  protected onGeneratePreview(): void {
    this.parser.generatePreviewContent(this.parserModel());
  }

  protected onRefreshTemplates(): void {
    this.parser.regenerateTemplates();
  }

  private onSave(): void {
    this.parser.storeFormData(this.parserModel());
  }
}
