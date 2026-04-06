import { inject, Pipe, PipeTransform } from '@angular/core';
import { tagConfigsStateToken } from '@client/tag-configs/tag-configs-store';

@Pipe({
  name: 'tagConfigColor',
})
export class TagConfigColorPipe implements PipeTransform {
  private readonly tagConfigsState = inject(tagConfigsStateToken);

  public transform(
    tag: string | string[],
    options: { checkUseForImageBorder?: boolean; checkUseForTextColor?: boolean; useForImageBadge?: boolean } = {}
  ): string | null {
    const { checkUseForImageBorder = false, checkUseForTextColor = false, useForImageBadge = false } = options;
    const tagConfigs = this.tagConfigsState.state.configs();
    const borderColorConfig = tagConfigs.find(
      (config) =>
        (!checkUseForImageBorder || (checkUseForImageBorder && config.useForImageBorder)) &&
        (!checkUseForTextColor || (checkUseForTextColor && config.useForTextColor)) &&
        (!useForImageBadge || (useForImageBadge && config.useForImageBadge)) &&
        (Array.isArray(tag) ? tag.includes(config.tag) : tag === config.tag)
    );
    return borderColorConfig && borderColorConfig.color !== 'transparent' ? borderColorConfig.color : null;
  }
}
