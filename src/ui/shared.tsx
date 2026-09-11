import { useId, type ReactNode } from "react";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings, t, languageOptions } from "./model";
import type { SettingKey } from "../core/settings";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-icon">
        <img
          src={chrome.runtime.getURL("icons/icon-128.png")}
          width="38"
          height="38"
          alt=""
        />
      </span>
      <span>
        <strong>Wonder</strong>
        {!compact && (
          <span className="brand-sub">
            {t("双语阅读", "READ WITHOUT BORDERS")}
          </span>
        )}
      </span>
    </div>
  );
}
export function SaveStatus() {
  const { status, error } = useSettings();
  return (
    <div
      className={`save-status ${status === "error" ? "text-destructive" : ""}`}
      role="status"
      title={error}
    >
      {status === "saving" ? (
        <LoaderCircle size={14} className="animate-spin" />
      ) : status === "error" ? (
        <TriangleAlert size={14} />
      ) : (
        <Check size={14} />
      )}
      <span>
        {status === "saving"
          ? t("正在保存", "Saving")
          : status === "error"
            ? t("保存失败", "Save failed")
            : t("更改已保存", "Changes saved")}
      </span>
    </div>
  );
}
export function ErrorNotice() {
  const { error } = useSettings();
  return error ? (
    <p role="alert" className="error-notice">
      {error}
    </p>
  ) : null;
}
export function Choice({
  value,
  onChange,
  options,
  label,
  id,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} className="choice">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        collisionPadding={8}
        className="max-h-[min(18rem,var(--radix-select-content-available-height))]"
      >
        {options.map(([code, name]) => (
          <SelectItem key={code} value={code}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function LanguageChoice(
  props: Omit<Parameters<typeof Choice>[0], "options">,
) {
  return <Choice {...props} options={languageOptions} />;
}
export function Row({
  title,
  description,
  children,
  htmlFor,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="setting-row">
      <div className="row-copy">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="row-title">
            {title}
          </Label>
        ) : (
          <div className="row-title">{title}</div>
        )}
        {description && <p>{description}</p>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}
type BooleanKey = {
  [K in SettingKey]: import("../core/settings").Settings[K] extends string
    ? K
    : never;
}[SettingKey];
export function Toggle({
  name,
  title,
  description,
  onChange,
}: {
  name: BooleanKey;
  title: string;
  description?: string;
  onChange?: (checked: boolean) => void;
}) {
  const { values, set } = useSettings();
  const id = useId();
  return (
    <Row title={title} description={description} htmlFor={id}>
      <Switch
        id={id}
        checked={values[name] === "yes"}
        onCheckedChange={
          onChange ?? ((checked) => void set(name, checked ? "yes" : "no"))
        }
      />
    </Row>
  );
}
export function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="settings-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      <div className="panel">{children}</div>
    </section>
  );
}
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("取消", "Cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {t("确认", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
