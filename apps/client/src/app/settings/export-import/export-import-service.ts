import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { saveCompanionAppDownload } from '@shared/utils/companion-app-util';
import { TAG_MANAGEMENT_EXPORT_TYPE, TAG_MANAGEMENT_EXPORT_VERSION } from '../tag-management/tag-management-const';
import { TagManagementExportModel, TagManagementModel } from '../tag-management/tag-management-model';

@Injectable()
export class ExportImportService {
  private readonly document = inject(DOCUMENT);

  public saveDownload(fileName: string, mimeType: string, source: string): void {
    if (saveCompanionAppDownload(fileName, mimeType, source)) {
      return;
    }

    const blob = new Blob([source], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  public parseImportedTagManagement(source: string): TagManagementModel | null {
    try {
      const parsed = JSON.parse(source) as unknown;
      if (!this.isTagManagementExport(parsed)) return null;
      return parsed.tagManagement;
    } catch {
      return null;
    }
  }

  public mergeTagManagementConfigs(
    storedConfigs: TagManagementModel,
    importedConfigs: TagManagementModel,
    overwriteConflicts: boolean
  ): TagManagementModel {
    const importedConfigByTag = new Map(importedConfigs.map((config) => [config.tag, config]));
    return [
      ...storedConfigs.map((config) => (overwriteConflicts ? (importedConfigByTag.get(config.tag) ?? config) : config)),
      ...importedConfigs.filter((config) => !storedConfigs.some((storedConfig) => storedConfig.tag === config.tag)),
    ];
  }

  private isTagManagementExport(value: unknown): value is TagManagementExportModel {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const candidate = value as Partial<TagManagementExportModel>;
    return (
      candidate.type === TAG_MANAGEMENT_EXPORT_TYPE &&
      candidate.version === TAG_MANAGEMENT_EXPORT_VERSION &&
      Array.isArray(candidate.tagManagement) &&
      candidate.tagManagement.every((config) => this.isTagManagement(config))
    );
  }

  private isTagManagement(value: unknown): value is TagManagementModel[number] {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate['tag'] === 'string' &&
      (typeof candidate['color'] === 'string' || candidate['color'] === null) &&
      typeof candidate['useForImageBorder'] === 'boolean' &&
      typeof candidate['useForTextColor'] === 'boolean' &&
      typeof candidate['useForImageBadge'] === 'boolean' &&
      typeof candidate['weight'] === 'number' &&
      Number.isFinite(candidate['weight'])
    );
  }
}
