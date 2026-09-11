export type YesNo = 'yes' | 'no';
export const defaults = {
  pageTranslatorService: 'google', textTranslatorService: 'google', ttsSpeed: 1,
  enableDeepL: 'yes', isTranslateTitle: 'no', targetLanguage: null as string | null,
  targetLanguageTextTranslation: null as string | null, targetLanguages: [] as string[],
  alwaysTranslateSites: [] as string[], neverTranslateSites: [] as string[], specialRules: [] as string[],
  sitesToTranslateWhenHovering: [] as string[], langsToTranslateWhenHovering: [] as string[],
  alwaysTranslateLangs: [] as string[], neverTranslateLangs: [] as string[],
  customDictionary: new Map<string, string>(), showTranslatePageContextMenu: 'yes',
  showButtonInTheAddressBar: 'yes', isShowDualLanguage: 'yes', dualStyle: 'none', customDualStyle: '',
  showPopupMobile: 'yes', darkMode: 'auto', popupBlueWhenSiteIsTranslated: 'yes',
  // Legacy backup field; retained for round trips, not used to choose a popup.
  useOldPopup: 'yes',
  popupPanelSection: 1, showReleaseNotes: 'no', hotkeys: {} as Record<string,string>,
  translateTag_pre: 'yes', dontSortResults: 'no', translateDynamicallyCreatedContent: 'yes',
  autoTranslateWhenClickingALink: 'no', translateClickingOnce: 'no',
};
export type Settings = typeof defaults;
export type SettingKey = keyof Settings;
export function serialize(value: unknown): unknown {
  return value instanceof Map ? Object.fromEntries(value) : value instanceof Set ? [...value] : value;
}
export function normalize(key: SettingKey, value: unknown): Settings[SettingKey] {
  const fallback = defaults[key];
  if (value == null) return structuredClone(fallback);
  if ((key === 'pageTranslatorService' || key === 'textTranslatorService') && value === 'yandex') return 'edge';
  if (key === 'customDictionary') {
    const entries = value instanceof Map ? [...value] : typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : [];
    return new Map(entries.filter((e): e is [string,string] => typeof e[0] === 'string' && typeof e[1] === 'string'));
  }
  if (Array.isArray(fallback)) return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  if (key === 'hotkeys') return typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([,v]) => typeof v === 'string')) : {};
  if (fallback === null) return typeof value === 'string' ? value : null;
  return typeof value === typeof fallback ? value as Settings[SettingKey] : fallback;
}
export interface StorageAdapter {
  read(): Promise<Record<string, unknown>>;
  write(values: Record<string, unknown>): Promise<void>;
  subscribe(listener: (changes: Record<string, {newValue?: unknown}>) => void): void;
}
/** Same storage keys and backup format as 0.0.41; writes are ordered and observable. */
export class SettingsStore {
  private values: Record<string, unknown> = structuredClone(defaults);
  private observers = new Set<(key: string, value: unknown) => void>();
  private writes: Promise<void> = Promise.resolve();
  private ready = false;
  readonly initialized: Promise<void>;
  constructor(private storage: StorageAdapter, initialize: (store: SettingsStore) => Promise<void> = async () => {}) {
    storage.subscribe(changes => { void this.initialized.then(() => {
      for (const [key, change] of Object.entries(changes)) this.apply(key, change.newValue);
    }); });
    this.initialized = storage.read().then(async values => {
      for (const [key, value] of Object.entries(values)) this.apply(key, value, false);
      for (const key of ['pageTranslatorService', 'textTranslatorService']) {
        if (values[key] === 'yandex') {
          this.writes = this.writes.then(() => storage.write({[key]: 'edge'}));
        }
      }
      await this.flush();
      await initialize(this);
      this.ready = true;
    });
  }
  get<K extends SettingKey>(key: K): Settings[K];
  get(key: string): unknown;
  get(key: string): unknown { return structuredClone(this.values[key]); }
  set<K extends SettingKey>(key: K, value: Settings[K]): void;
  set(key: string, value: unknown): void;
  set(key: string, value: unknown): void {
    const next = Object.hasOwn(defaults, key) ? normalize(key as SettingKey, value) : value;
    if (JSON.stringify(serialize(this.values[key])) === JSON.stringify(serialize(next))) return;
    this.apply(key, next);
    const saved = serialize(this.values[key]);
    this.writes = this.writes.catch(() => {}).then(() => this.storage.write({[key]: saved}));
    void this.writes.catch(error => console.error('Cannot save settings', error));
  }
  flush(): Promise<void> { return this.writes; }
  onReady(callback?: () => void): Promise<void> {
    if (callback) { if (this.ready) callback(); else void this.initialized.then(callback); }
    return this.initialized;
  }
  onChanged(callback: (key: string, value: unknown) => void): () => void {
    this.observers.add(callback); return () => this.observers.delete(callback);
  }
  export(version: string): string {
    return JSON.stringify({timeStamp: Date.now(), version, ...Object.fromEntries(Object.keys(defaults).map(k => [k, serialize(this.values[k])]))}, null, 4);
  }
  async import(json: string): Promise<void> {
    const data: unknown = JSON.parse(json);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Invalid settings backup');
    for (const key of Object.keys(defaults)) if (Object.hasOwn(data, key)) this.set(key, (data as Record<string, unknown>)[key]);
    await this.flush();
  }
  private apply(key: string, value: unknown, notify = true): void {
    const next = Object.hasOwn(defaults, key) ? normalize(key as SettingKey, value) : value;
    if (JSON.stringify(serialize(this.values[key])) === JSON.stringify(serialize(next))) return;
    this.values[key] = structuredClone(next);
    if (notify) for (const observer of this.observers) observer(key, this.get(key));
  }
}
