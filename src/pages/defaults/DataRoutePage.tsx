import { useParams } from "react-router-dom";
import { DataManagementList } from "openxiangda";

import {
  defaultPageOverrides,
  resolveDefaultPageOverride,
} from "@/runtime/default-page-overrides";

export function DataRoutePage() {
  const { appType = "", formUuid = "" } = useParams();
  const Override = resolveDefaultPageOverride(defaultPageOverrides, "data-manage-list", formUuid);
  const defaultNode = (
    <DataManagementList
      appType={appType}
      detailBasePath={`/view/${appType}/admin/forms/${formUuid}`}
      formUuid={formUuid}
      fullHeight={false}
      title="数据列表"
    />
  );

  return (
    <div className="ox-default-data-route min-w-0 overflow-hidden">
      {Override ? (
        <Override
          appType={appType}
          defaultNode={defaultNode}
          formUuid={formUuid}
          kind="data-manage-list"
        />
      ) : (
        defaultNode
      )}
    </div>
  );
}
