import { useSettings } from "@/hooks/useSettings";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

export function GovernanceSwitch() {
  const { settings, updateSettings } = useSettings();
  const { t } = useTranslation("settings");

  if (!settings) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="enable-governance"
        aria-label="Governance"
        checked={settings.enableGovernance ?? true}
        onCheckedChange={(checked) => {
          updateSettings({ enableGovernance: checked });
        }}
      />
      <Label htmlFor="enable-governance">{t("workflow.governance")}</Label>
    </div>
  );
}
