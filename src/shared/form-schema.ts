import { defineFormSchema } from "openxiangda";

export type FormComponentName =
  | "TextField"
  | "TextAreaField"
  | "NumberField"
  | "DateField"
  | "CascadeDateField"
  | "SelectField"
  | "MultiSelectField"
  | "RadioField"
  | "CheckboxField"
  | "UserSelectField"
  | "DepartmentSelectField"
  | "AttachmentField"
  | "ImageField"
  | "AddressField"
  | "CascadeSelectField"
  | "LocationField"
  | "EditorField"
  | "JSONField"
  | "SubFormField";

export type FormOption = {
  label: string;
  value: string;
  color?: string;
  disabled?: boolean;
};

export type FieldDefinition = {
  fieldId: string;
  componentName: FormComponentName;
  label: string;
  required?: boolean;
  behavior?: "NORMAL" | "READONLY" | "DISABLED" | "HIDDEN";
  rules?: Array<{
    required?: boolean;
    message?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    preset?: "phone" | "idCard" | "email" | "url" | "bankCard";
    pattern?: RegExp | string;
  }>;
  placeholder?: string;
  tips?: string;
  options?: FormOption[];
  defaultValue?: unknown;
  columns?: FieldDefinition[];
  [key: string]: unknown;
};

export type OpenXiangdaFormSchemaInput = {
  formMeta: {
    formUuid: string;
    appType: string;
    title: string;
    formType?: "receipt" | "process";
  };
  fields: FieldDefinition[];
  template?: Record<string, unknown>;
};

export function option(value: string, label = value): FormOption {
  return { label, value };
}

export function options(values: string[]): FormOption[] {
  return values.map((value) => option(value));
}

export function createFormSchema(input: OpenXiangdaFormSchemaInput) {
  return defineFormSchema({
    formMeta: input.formMeta,
    template: {
      ...(input.template || {}),
      ...(input.formMeta.formType === "process" ? { formType: "process" } : {}),
    },
    fields: input.fields.map(normalizeField),
    layout: input.fields.map((field) => ({
      id: `layout_${field.fieldId}`,
      type: "field" as const,
      fieldId: field.fieldId,
    })),
  });
}

function normalizeField(field: FieldDefinition): FieldDefinition {
  return {
    ...field,
    options:
      needsOptionsArray(field.componentName) && !Array.isArray(field.options)
        ? []
        : field.options,
    columns: field.columns?.map(normalizeField),
    rules:
      field.rules ||
      (field.required
        ? [
            {
              required: true,
              message: `${needsSelectVerb(field.componentName) ? "请选择" : "请填写"}${field.label}`,
            },
          ]
        : undefined),
  };
}

function needsOptionsArray(componentName: FormComponentName): boolean {
  return [
    "SelectField",
    "MultiSelectField",
    "RadioField",
    "CheckboxField",
    "CascadeSelectField",
  ].includes(componentName);
}

function needsSelectVerb(componentName: FormComponentName): boolean {
  return [
    "SelectField",
    "MultiSelectField",
    "RadioField",
    "CheckboxField",
    "UserSelectField",
    "DepartmentSelectField",
    "DateField",
    "CascadeDateField",
    "CascadeSelectField",
    "ImageField",
    "AttachmentField",
  ].includes(componentName);
}
