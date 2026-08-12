import type { ComponentType, ReactNode } from "react";

export type DefaultPageKind =
  | "form-submit"
  | "process-submit"
  | "form-detail"
  | "process-detail"
  | "data-manage-list"
  | "file-preview";

export interface DefaultPageOverrideProps {
  kind: DefaultPageKind;
  appType: string;
  formUuid?: string;
  formInstId?: string;
  schema?: any;
  defaultNode: ReactNode;
}

export type DefaultPageOverrideComponent = ComponentType<DefaultPageOverrideProps>;

export type DefaultPageOverrides = Partial<
  Record<DefaultPageKind, Record<string, DefaultPageOverrideComponent | undefined>>
>;

export const defaultPageOverrides: DefaultPageOverrides = {};

export function resolveDefaultPageOverride(
  overrides: DefaultPageOverrides,
  kind: DefaultPageKind,
  formUuid?: string,
) {
  const byKind = overrides[kind] || {};
  return (formUuid && byKind[formUuid]) || byKind["*"];
}
