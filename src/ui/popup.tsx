import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Globe2,
  Languages,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Brand, Choice, ErrorNotice, LanguageChoice } from "./shared";
import {
  SettingsProvider,
  api,
  addRule,
  removeRule,
  t,
  config,
  languages,
  useSettings,
} from "./model";
function Popup() {
  useEffect(() => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    const handleResize = (event: UIEvent) => {
      const unchanged =
        width === window.innerWidth && height === window.innerHeight;
      width = window.innerWidth;
      height = window.innerHeight;
      // Chrome/Edge action popups emit resize when a portal locks scrolling,
      // even if the viewport stays the same. Radix Select closes on resize.
      // Register before opening any select; preserve real resize and blur events.
      if (
        unchanged &&
        document.querySelector(
          '[data-slot="select-content"][data-state="open"]',
        )
      ) {
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("resize", handleResize, true);
    return () => window.removeEventListener("resize", handleResize, true);
  }, []);
  const { values, run } = useSettings();
  const [tab, setTab] = useState<chrome.tabs.Tab>(),
    [state, setState] = useState("loading"),
    [original, setOriginal] = useState("und"),
    [busy, setBusy] = useState(false);
  const [service, setService] = useState(values.pageTranslatorService);
  const message = (action: string, fields = {}) =>
    api.tabs.sendMessage(tab!.id!, { action, ...fields }, { frameId: 0 });
  useEffect(() => {
    let active = true;
    void (async () => {
      const [current] = await api.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!active) return;
      setTab(current);
      if (!current?.id) {
        setState("unavailable");
        return;
      }
      const results = await Promise.allSettled(
        [
          "getCurrentPageLanguageState",
          "getOriginalTabLanguage",
          "getCurrentPageTranslatorService",
        ].map((action) =>
          api.tabs.sendMessage(current.id!, { action }, { frameId: 0 }),
        ),
      );
      if (!active) return;
      const [page, language, engine] = results;
      setState(
        page.status === "fulfilled" && page.value ? page.value : "unavailable",
      );
      if (language.status === "fulfilled" && language.value)
        setOriginal(language.value);
      if (engine.status === "fulfilled" && engine.value)
        setService(engine.value);
    })().catch(() => {
      if (active) setState("unavailable");
    });
    return () => {
      active = false;
    };
  }, []);
  const hostname = (() => {
    try {
      return new URL(tab?.url || "").hostname;
    } catch {
      return "";
    }
  })();
  const available = state !== "loading" && state !== "unavailable";
  const translated = state === "translated";
  const translate = () =>
    void run(async () => {
      setBusy(true);
      try {
        await config.flush();
        await message(translated ? "restorePage" : "translatePage", {
          targetLanguage: values.targetLanguage,
        });
        setState(translated ? "original" : "translated");
      } finally {
        setBusy(false);
      }
    });
  const always = values.alwaysTranslateSites.includes(hostname);
  return (
    <div className="popup-shell">
      <header className="popup-header">
        <Brand compact />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("打开设置", "Open settings")}
          onClick={() => void run(() => api.runtime.openOptionsPage())}
        >
          <Settings2 />
        </Button>
      </header>
      <main className="popup-main">
        <div className="page-context">
          <span className="site-symbol">
            <Globe2 size={19} />
          </span>
          <div>
            <strong>{hostname || t("当前页面", "Current page")}</strong>
            <span>
              {original !== "und"
                ? languages.codeToLanguage(original)
                : t("网页翻译", "Page translation")}
            </span>
          </div>
          <Badge
            variant="secondary"
            className={translated ? "translated-badge" : ""}
          >
            {translated ? <Check size={12} /> : null}
            {state === "loading"
              ? t("连接中", "Connecting")
              : translated
                ? t("已翻译", "Translated")
                : t("原文", "Original")}
          </Badge>
        </div>
        <div className="popup-intro">
          <h1>{t("读懂更大的世界", "A world worth reading")}</h1>
          <p>
            {t(
              "保留原文语境，轻松阅读译文。",
              "Read naturally, with the original in view.",
            )}
          </p>
        </div>
        <div className="popup-field">
          <label id="target-label">{t("翻译为", "Translate into")}</label>
          <LanguageChoice
            id="selectTargetLanguage"
            value={values.targetLanguage || "zh-CN"}
            label={t("目标语言", "Target language")}
            onChange={(value) =>
              void run(() => config.setTargetLanguage(value, true))
            }
          />
        </div>
        <div className="popup-field">
          <label>{t("翻译服务", "Translation service")}</label>
          <Choice
            value={service}
            label={t("翻译服务", "Translation service")}
            options={[
              ["google", "Google Translate"],
              ["edge", "Edge Translate"],
            ]}
            onChange={(value) =>
              void run(async () => {
                if (value !== service && available)
                  await message("swapTranslationService");
                config.set("pageTranslatorService", value);
                setService(value);
              })
            }
          />
        </div>
        <ErrorNotice />
        {state === "unavailable" && (
          <p className="unavailable-note" role="status">
            {t(
              "此页面暂时无法翻译。请打开普通网页；若刚安装扩展，请刷新网页后重试。",
              "This page cannot be translated. Open a regular web page, or reload it if you just installed the extension.",
            )}
          </p>
        )}
        <Button
          id={translated ? "btnRestore" : "btnTranslate"}
          className="translate-button"
          disabled={!available || busy}
          onClick={translate}
        >
          {busy || state === "loading" ? (
            <LoaderCircle className="animate-spin" />
          ) : translated ? (
            <RotateCcw />
          ) : (
            <Languages />
          )}
          {translated
            ? t("显示原文", "Show original")
            : t("翻译此页", "Translate this page")}
          {!translated && !busy && <ArrowRight className="ml-auto" />}
        </Button>
        <div className="popup-preferences">
          <div>
            <label htmlFor="popup-dual">
              {t("双语对照", "Bilingual reading")}
            </label>
            <Switch
              id="popup-dual"
              checked={values.isShowDualLanguage === "yes"}
              onCheckedChange={(checked) =>
                void run(async () => {
                  config.set("isShowDualLanguage", checked ? "yes" : "no");
                  await config.flush();
                  if (available) await message("refresh-dual-language");
                })
              }
            />
          </div>
          <div>
            <label htmlFor="popup-always">
              {t("总是翻译此网站", "Always translate this site")}
            </label>
            <Switch
              id="popup-always"
              checked={always}
              disabled={!hostname || !available}
              onCheckedChange={(checked) =>
                void run(() =>
                  checked
                    ? addRule("alwaysTranslateSites", hostname)
                    : removeRule("alwaysTranslateSites", hostname),
                )
              }
            />
          </div>
          {original !== "und" && original !== values.targetLanguage && (
            <div>
              <label htmlFor="popup-always-language">
                {t("总是翻译", "Always translate")}{" "}
                {languages.codeToLanguage(original)}
              </label>
              <Switch
                id="popup-always-language"
                checked={values.alwaysTranslateLangs.includes(original)}
                onCheckedChange={(checked) =>
                  void run(() =>
                    checked
                      ? addRule("alwaysTranslateLangs", original, hostname)
                      : removeRule("alwaysTranslateLangs", original),
                  )
                }
              />
            </div>
          )}
        </div>
      </main>
      <footer className="popup-footer">
        <span>Wonder</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("更多选项", "More options")}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem
              disabled={!available}
              onSelect={() =>
                void run(() =>
                  values.neverTranslateSites.includes(hostname)
                    ? removeRule("neverTranslateSites", hostname)
                    : addRule("neverTranslateSites", hostname),
                )
              }
            >
              {values.neverTranslateSites.includes(hostname) && <Check />}
              {t("永不翻译此网站", "Never translate this site")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!available || original === "und"}
              onSelect={() =>
                void run(() =>
                  values.neverTranslateLangs.includes(original)
                    ? removeRule("neverTranslateLangs", original)
                    : addRule("neverTranslateLangs", original, hostname),
                )
              }
            >
              {values.neverTranslateLangs.includes(original) && <Check />}
              {t("永不翻译此语言", "Never translate this language")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!available}
              onSelect={() =>
                void run(() =>
                  api.tabs.create({
                    url: `https://translate.google.com/translate?sl=auto&tl=${values.targetLanguage}&u=${encodeURIComponent(tab?.url || "")}`,
                  }),
                )
              }
            >
              <ExternalLink />
              {t("在 Google 翻译中打开", "Open in Google Translate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void run(() => api.runtime.openOptionsPage())}
            >
              <Settings2 />
              {t("全部设置", "All settings")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </footer>
    </div>
  );
}
document.documentElement.lang = chrome.i18n.getUILanguage();
createRoot(document.getElementById("root")!).render(
  <SettingsProvider>
    <Popup />
  </SettingsProvider>,
);
