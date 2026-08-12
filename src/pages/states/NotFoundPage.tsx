import { Compass, Home } from "lucide-react";
import { useParams } from "react-router-dom";

import { PrimaryButton, SecondaryButton, StatePage } from "@/shared/ui";

export function NotFoundPage() {
  const { appType = process.env.OPENXIANGDA_APP_TYPE || "" } = useParams();
  const home = appType ? `/view/${appType}/admin` : "/";

  return (
    <StatePage
      actions={
        <>
          <SecondaryButton onClick={() => window.history.back()}>
            <Compass size={17} />
            返回上一页
          </SecondaryButton>
          <PrimaryButton onClick={() => window.location.assign(home)}>
            <Home size={17} />
            返回入口
          </PrimaryButton>
        </>
      }
      description="当前访问的页面不存在，可能是链接已变更或你没有从正确入口进入。"
      fullScreen
      icon={<Compass size={24} />}
      status="404"
      title="页面不存在"
    />
  );
}
