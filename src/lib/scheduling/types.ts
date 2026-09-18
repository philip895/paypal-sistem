export const ROLES = ["OWNER", "ADMIN", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const AUTOMATION_MODES = ["SIMULATION", "LIVE"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

export const CONFIG_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type ConfigStatus = (typeof CONFIG_STATUSES)[number];

export const CONNECTION_STATUSES = ["CONNECTED", "DISCONNECTED", "ERROR"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const ELIGIBILITY_STATUSES = ["ELIGIBLE", "INELIGIBLE"] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export const EXPIRY_MODES = [
  "FIXED_DURATION",
  "UNTIL_NEXT_SCHEDULE",
  "UNTIL_DISABLED",
] as const;
export type ExpiryMode = (typeof EXPIRY_MODES)[number];

export const ACTIVATION_REASONS = [
  "RECURRING",
  "ONE_TIME_OVERRIDE",
  "MANUAL_OVERRIDE",
  "SAFE_DEFAULT",
  "STARTUP_RECONCILE",
] as const;
export type ActivationReason = (typeof ACTIVATION_REASONS)[number];

export const ACTIVATION_RESULTS = ["SUCCESS", "FAILED", "ROLLED_BACK"] as const;
export type ActivationResult = (typeof ACTIVATION_RESULTS)[number];

export interface ManualOverrideRecord {
  id: string;
  configId: string;
  startedAt: Date;
  expiresAt: Date | null;
  expiryMode: ExpiryMode;
  active: boolean;
}

export interface ScheduleOverrideRecord {
  id: string;
  configId: string;
  startAt: Date;
  endAt: Date;
}

export interface RecurringRuleRecord {
  id: string;
  configId: string;
  dayOfWeek: number; // 0=Sunday .. 6=Saturday, wall-clock day in store timezone
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm" — equal to or earlier than startTime means it crosses midnight
  active: boolean;
}

export type ResolutionSource =
  | "MANUAL_OVERRIDE"
  | "ONE_TIME_OVERRIDE"
  | "RECURRING"
  | "SAFE_DEFAULT"
  | "NONE";

export interface ResolvedConfiguration {
  configId: string | null;
  source: ResolutionSource;
  reason: string;
  sourceId: string | null;
  activeSince: Date | null;
  /** Null means open-ended (no known future boundary). */
  activeUntil: Date | null;
}

export interface ResolutionInput {
  now: Date;
  timezone: string;
  manualOverrides: ManualOverrideRecord[];
  scheduleOverrides: ScheduleOverrideRecord[];
  recurringRules: RecurringRuleRecord[];
  safeDefaultConfigId: string | null;
}
