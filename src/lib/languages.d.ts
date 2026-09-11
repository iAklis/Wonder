export const languages: {
  getLanguageList(): Record<string, string>;
  normalizeTargetLanguageCode(code: string | null | undefined): string | undefined;
  normalizeUiLanguageCode(code: string | null | undefined): string | undefined;
  codeToLanguage(code: string): string;
  getAlternativeService(target: string, service: string, html: boolean): string;
};
