import { useLocation } from "react-router-dom";
import { EmptyState } from "@klickit/ui";
import { MODULE_PLACEHOLDERS } from "../config/navigation.js";

export function ModulePlaceholderPage() {
  const location = useLocation();
  const module = MODULE_PLACEHOLDERS[location.pathname];

  if (!module) {
    return <EmptyState title="Module not found" description="This route is reserved for a future UI module." />;
  }

  return (
    <EmptyState
      title={`${module.title} — coming next`}
      description={`${module.description} Reply APPROVE UI MODULE after reviewing Module 1 (Login and Application Shell).`}
    />
  );
}
