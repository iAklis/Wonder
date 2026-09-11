import type { SettingsStore } from "../core/settings";
export const config: Pick<
  SettingsStore,
  "get" | "set" | "onReady" | "onChanged" | "flush"
> & {
  export(): string;
  import(json: string): Promise<void>;
  restoreToDefault(): Promise<void>;
  addSiteToNeverTranslate(hostname: string): void;
  addSiteToAlwaysTranslate(hostname: string): void;
  addLangToAlwaysTranslate(lang: string, hostname?: string): void;
  addLangToNeverTranslate(lang: string, hostname?: string): void;
  setTargetLanguage(lang: string, forTextToo?: boolean): void;
};
