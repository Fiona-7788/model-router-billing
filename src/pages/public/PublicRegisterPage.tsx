import { ClipboardList } from "lucide-react";

import { StatePage } from "@/shared/ui";

export function PublicRegisterPage() {
  return (
    <StatePage
      description="请填写报名信息并关注后续通知。"
      fullScreen
      icon={<ClipboardList size={24} />}
      status="PUBLIC"
      title="公开报名"
    />
  );
}
