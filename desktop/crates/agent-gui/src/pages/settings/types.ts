import type { AppUpdateController } from "../../lib/appUpdates";
import type { BoxAISessionUser } from "../../lib/boxaiAuth/session";
import type { AppSettings } from "../../lib/settings";
import type { SettingsSaveState } from "../../lib/settings/storage";

export type SetSettingsFn = (updater: (prev: AppSettings) => AppSettings) => void;

// BOXAI: signed-in account surfaced in the settings sidebar (with sign-out).
export type BoxAIAccountControls = {
  serverUrl: string;
  user: BoxAISessionUser;
  onLogout: () => void;
};

export type SectionId =
  | "system"
  | "systemTools"
  | "providers"
  | "agents"
  | "ssh"
  | "memory"
  | "hooks"
  | "cron"
  | "remote"
  | "about";

export type SettingsPageProps = {
  settings: AppSettings;
  setSettings: SetSettingsFn;
  saveState: SettingsSaveState;
  onBack: () => void;
  initialSection?: SectionId;
  hiddenSections?: SectionId[];
  account?: BoxAIAccountControls;
  appUpdate: AppUpdateController;
};

export type SettingsSectionProps = {
  settings: AppSettings;
  setSettings: SetSettingsFn;
};
