import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { defaults, type Settings, type SettingKey } from "../core/settings";
import { config } from "../lib/config.js";
import { languages } from "../lib/languages.js";

// Firefox's browser namespace and Chromium's chrome namespace both return promises.
export const api =
  (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ??
  chrome;
export const isFirefox = "browser" in globalThis;
export const zh = chrome.i18n.getUILanguage().startsWith("zh");
export function t(chinese: string, english: string, message?: string) {
  return message
    ? chrome.i18n.getMessage(message) || (zh ? chinese : english)
    : zh
      ? chinese
      : english;
}
export const languageOptions = Object.entries(languages.getLanguageList());
interface Model {
  values: Settings;
  status: "saved" | "saving" | "error";
  error: string;
  run: (action: () => void | Promise<unknown>) => Promise<void>;
  set: <K extends SettingKey>(key: K, value: Settings[K]) => Promise<void>;
}
const Context = createContext<Model | null>(null);
function snapshot(): Settings {
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, config.get(key)]),
  ) as Settings;
}
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Settings | null>(null);
  const [status, setStatus] = useState<Model["status"]>("saved");
  const [error, setError] = useState("");
  const operation = useRef(0);
  useEffect(() => {
    let active = true;
    const unsubscribe = config.onChanged(() => {
      if (active) setValues(snapshot());
    });
    void config
      .onReady()
      .then(() => {
        if (active) setValues(snapshot());
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const run = useCallback(async (action: () => void | Promise<unknown>) => {
    const current = ++operation.current;
    setStatus("saving");
    setError("");
    try {
      await action();
      await config.flush();
      if (current === operation.current) setStatus("saved");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  const set = useCallback(
    <K extends SettingKey>(key: K, value: Settings[K]) =>
      run(() => config.set(key, value)),
    [run],
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const dark =
        values?.darkMode === "yes" ||
        (values?.darkMode !== "no" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [values?.darkMode]);
  if (!values)
    return (
      <div className="loading" role="status">
        {error || t("正在载入设置…", "Loading settings…")}
      </div>
    );
  return (
    <Context.Provider value={{ values, status, error, run, set }}>
      {children}
    </Context.Provider>
  );
}
export function useSettings() {
  const model = useContext(Context);
  if (!model) throw new Error("SettingsProvider is required");
  return model;
}
export type RuleKey =
  | "alwaysTranslateSites"
  | "neverTranslateSites"
  | "alwaysTranslateLangs"
  | "neverTranslateLangs";
export function addRule(key: RuleKey, raw: string, hostname?: string) {
  const language = key.endsWith("Langs");
  let value = raw.trim();
  if (language) {
    const code = languages.normalizeTargetLanguageCode(value);
    if (!code) throw new Error(t("请选择有效语言", "Choose a valid language"));
    value = code;
  } else {
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname ||
        /\s/.test(value)
      )
        throw new Error();
      value = url.hostname;
    } catch {
      throw new Error(
        t(
          "请输入有效域名，例如 example.com",
          "Enter a valid hostname, such as example.com",
        ),
      );
    }
  }
  const actions = {
    alwaysTranslateSites: config.addSiteToAlwaysTranslate,
    neverTranslateSites: config.addSiteToNeverTranslate,
    alwaysTranslateLangs: config.addLangToAlwaysTranslate,
    neverTranslateLangs: config.addLangToNeverTranslate,
  };
  actions[key](value, hostname);
}
export function removeRule(key: RuleKey, value: string) {
  config.set(
    key,
    config.get(key).filter((item) => item !== value),
  );
}
export async function setAutoTranslate(enabled: boolean) {
  if (enabled) {
    const granted = await api.permissions.request({
      permissions: ["webNavigation"],
    });
    if (!granted)
      throw new Error(
        t(
          "未授予导航权限，已保留原设置。",
          "Navigation permission was not granted. The setting is unchanged.",
        ),
      );
    config.set("autoTranslateWhenClickingALink", "yes");
  } else {
    config.set("autoTranslateWhenClickingALink", "no");
    await api.permissions.remove({ permissions: ["webNavigation"] });
  }
}
export { config, languages };
