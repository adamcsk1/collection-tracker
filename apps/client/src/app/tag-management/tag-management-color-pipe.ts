import { inject, Pipe, PipeTransform } from '@angular/core';
import { tagManagementStateToken } from './tag-management-store';

@Pipe({
  name: 'tagManagementColor',
})
export class TagManagementColorPipe implements PipeTransform {
  private readonly tagManagementState = inject(tagManagementStateToken);

  public transform(
    tag: string | string[],
    options: { checkUseForImageBorder?: boolean; checkUseForTextColor?: boolean; useForImageBadge?: boolean } = {}
  ): string | null {
    const { checkUseForImageBorder = false, checkUseForTextColor = false, useForImageBadge = false } = options;
    const tagManagement = this.tagManagementState.state.configs();
    const borderColorConfig = tagManagement.find(
      (config) =>
        (!checkUseForImageBorder || (checkUseForImageBorder && config.useForImageBorder)) &&
        (!checkUseForTextColor || (checkUseForTextColor && config.useForTextColor)) &&
        (!useForImageBadge || (useForImageBadge && config.useForImageBadge)) &&
        (Array.isArray(tag) ? tag.includes(config.tag) : tag === config.tag)
    );
    return borderColorConfig && borderColorConfig.color !== 'transparent' ? borderColorConfig.color : null;
  }
}
