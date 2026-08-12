export interface RuntimeDefaultRoutes {
  formSubmit?: {
    formUuid?: string;
  };
  processSubmit?: {
    formUuid?: string;
  };
  dataManageList?: {
    formUuid?: string;
  };
  filePreview?: {
    ticket?: string;
  };
}

export const runtimeDefaultRoutes: RuntimeDefaultRoutes = {};
