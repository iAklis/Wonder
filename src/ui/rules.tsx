import { useState } from "react";
import { Plus, Trash2, Globe2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useSettings,
  t,
  addRule,
  removeRule,
  languages,
  config,
  type RuleKey,
} from "./model";
import { Section, LanguageChoice } from "./shared";

export function RuleList({
  name,
  title,
  description,
}: {
  name: RuleKey;
  title: string;
  description: string;
}) {
  const { values, run } = useSettings();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [error, setError] = useState("");
  const isLanguage = name.endsWith("Langs");
  const label = isLanguage ? t("语言", "Language") : t("域名", "Hostname");
  return (
    <Section
      title={title}
      description={description}
      action={
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setError("");
            setValue("");
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus />
              {t("添加", "Add")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  addRule(name, value);
                  void run(() => {});
                  setOpen(false);
                } catch (e) {
                  setError(String((e as Error).message));
                }
              }}
            >
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </DialogHeader>
              <div className="dialog-fields">
                <Label htmlFor={`${name}-value`}>{label}</Label>
                {isLanguage ? (
                  <LanguageChoice
                    id={`${name}-value`}
                    value={value}
                    label={label}
                    onChange={setValue}
                  />
                ) : (
                  <Input
                    id={`${name}-value`}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="example.com"
                    autoComplete="off"
                    required
                  />
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {t("取消", "Cancel")}
                </Button>
                <Button type="submit" disabled={!value.trim()}>
                  {t("添加规则", "Add rule")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {values[name].length ? (
        <ul className="rule-list">
          {values[name].map((value) => (
            <li key={value}>
              <span className="list-icon">
                <Globe2 size={16} />
              </span>
              <span className="grow break-all">
                {isLanguage ? languages.codeToLanguage(value) : value}
              </span>
              {isLanguage && <Badge variant="secondary">{value}</Badge>}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("删除", "Remove")} ${value}`}
                onClick={() => void run(() => removeRule(name, value))}
              >
                <Trash2 size={15} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <Globe2 size={23} />
          <p>{t("尚未添加规则", "No rules yet")}</p>
          <span>
            {t(
              "仅对添加的站点或语言生效。",
              "Applies only to the sites or languages you add.",
            )}
          </span>
        </div>
      )}
    </Section>
  );
}
export function Dictionary() {
  const { values, set } = useSettings();
  const [open, setOpen] = useState(false),
    [word, setWord] = useState(""),
    [replacement, setReplacement] = useState(""),
    [error, setError] = useState("");
  return (
    <Section
      title={t("自定义词典", "Custom dictionary")}
      description={t(
        "保留专业词汇，或使用你指定的译文。",
        "Keep specific terms unchanged, or use your preferred wording.",
      )}
      action={
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setWord("");
            setReplacement("");
            setError("");
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus />
              {t("添加词条", "Add term")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const key = word.trim().toLowerCase();
                if (key.length < 2) {
                  setError(
                    t("词条至少需要两个字符。", "Use at least two characters."),
                  );
                  return;
                }
                if (values.customDictionary.has(key)) {
                  setError(
                    t(
                      "该词条已存在，请先删除再添加。",
                      "This term already exists. Remove it before adding a replacement.",
                    ),
                  );
                  return;
                }
                const next = new Map(values.customDictionary);
                next.set(key, replacement.trim());
                void set("customDictionary", next);
                setOpen(false);
              }}
            >
              <DialogHeader>
                <DialogTitle>{t("添加词条", "Add term")}</DialogTitle>
                <DialogDescription>
                  {t(
                    "替换文本留空时，原词会保留，不参与翻译。",
                    "Leave the replacement empty to keep the original term untranslated.",
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="dialog-fields">
                <Label htmlFor="dictionary-word">
                  {t("原词", "Original term")}
                </Label>
                <Input
                  id="dictionary-word"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder="TypeScript"
                  required
                />
                <Label htmlFor="dictionary-replacement">
                  {t("替换文本（可选）", "Replacement (optional)")}
                </Label>
                <Input
                  id="dictionary-replacement"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                />
                {error && (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {t("取消", "Cancel")}
                </Button>
                <Button type="submit">{t("添加词条", "Add term")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {values.customDictionary.size ? (
        <ul className="rule-list">
          {[...values.customDictionary]
            .sort(([a], [b]) => b.length - a.length)
            .map(([key, value]) => (
              <li key={key}>
                <BookOpen size={16} />
                <span className="grow break-all">
                  <strong className="font-medium">{key}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {value || t("保留原文", "Keep original")}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t("删除", "Remove")} ${key}`}
                  onClick={() => {
                    const next = new Map(values.customDictionary);
                    next.delete(key);
                    void set("customDictionary", next);
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </li>
            ))}
        </ul>
      ) : (
        <div className="empty-state">
          <BookOpen size={23} />
          <p>{t("让专业词汇保持准确", "Keep your terminology consistent")}</p>
          <span>
            {t(
              "添加品牌名、缩写或专业术语。",
              "Add brand names, abbreviations, or technical terms.",
            )}
          </span>
        </div>
      )}
    </Section>
  );
}
export function SpecialRules() {
  const { values, run } = useSettings();
  const [draft, setDraft] = useState(""),
    [error, setError] = useState("");
  return (
    <Section
      title={t("网站适配规则", "Custom site rules")}
      description={t(
        "为特定网站设置内容选择器，兼容旧版 JSON 规则。",
        "Configure content selectors for specific sites using the original JSON rule format.",
      )}
    >
      <form
        className="p-5 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const rule: unknown = JSON.parse(draft);
            if (!rule || typeof rule !== "object" || Array.isArray(rule))
              throw new Error();
            void run(() =>
              config.set("specialRules", [
                ...new Set([...values.specialRules, draft.trim()]),
              ]),
            );
            setDraft("");
            setError("");
          } catch {
            setError(
              t("请输入有效的 JSON 对象。", "Enter a valid JSON object."),
            );
          }
        }}
      >
        <Label htmlFor="special-rule">{t("规则 JSON", "Rule JSON")}</Label>
        <Textarea
          id="special-rule"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            '{ "hostname": "example.com", "selectors": ["article"] }'
          }
          className="min-h-28 font-mono text-xs"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" disabled={!draft.trim()}>
            <Plus />
            {t("添加规则", "Add rule")}
          </Button>
        </div>
      </form>
      {values.specialRules.length > 0 && (
        <ul className="rule-list border-t">
          {values.specialRules.map((rule) => (
            <li key={rule}>
              <code className="grow text-xs break-all whitespace-pre-wrap">
                {rule}
              </code>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("删除规则", "Remove rule")} ${rule}`}
                onClick={() =>
                  void run(() =>
                    config.set(
                      "specialRules",
                      values.specialRules.filter((value) => value !== rule),
                    ),
                  )
                }
              >
                <Trash2 size={15} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
