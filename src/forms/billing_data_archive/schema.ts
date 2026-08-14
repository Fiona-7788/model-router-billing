/**
 * 账单数据归档表单 schema
 * 用于存储每日从阿里云 Model Router 归档的账单数据
 */
export default {
  code: "billing_data_archive",
  name: "账单数据归档",
  formType: "receipt",
  fields: [
    {
      fieldId: "archive_date",
      componentName: "DateField",
      label: "归档日期",
      required: true,
    },
    {
      fieldId: "data_json",
      componentName: "TextAreaField",
      label: "归档数据(JSON)",
      required: true,
    },
    {
      fieldId: "record_count",
      componentName: "NumberField",
      label: "记录数",
      required: false,
    },
    {
      fieldId: "archive_type",
      componentName: "SelectField",
      label: "归档类型",
      required: true,
      options: [
        { label: "每日归档", value: "daily" },
        { label: "手动归档", value: "manual" },
      ],
    },
  ],
};
