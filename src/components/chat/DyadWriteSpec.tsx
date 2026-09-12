import React, { useEffect } from "react";
import { ScrollText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { previewModeAtom, selectedAppIdAtom } from "@/atoms/appAtoms";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import { useGovernanceSpecBundle } from "@/hooks/use_governance";
import { queryKeys } from "@/lib/queryKeys";

interface DyadWriteSpecProps {
  node: {
    properties: {
      title?: string;
      stories?: string;
      criteria?: string;
    };
  };
}

/**
 * Governed plan mode: rendered when the model calls write_spec. Surfaces the
 * plan panel so the user can review and approve the spec bundle.
 */
export const DyadWriteSpec: React.FC<DyadWriteSpecProps> = ({ node }) => {
  const { title, stories, criteria } = node.properties;
  const setPreviewMode = useSetAtom(previewModeAtom);
  const setIsPreviewOpen = useSetAtom(isPreviewOpenAtom);
  const appId = useAtomValue(selectedAppIdAtom);
  // Wait for the bundle to load before surfacing the plan panel so the
  // panel's empty-plan bounce cannot immediately win the race. The card can
  // mount before write_spec finishes persisting, so poll until the bundle
  // actually exists.
  const queryClient = useQueryClient();
  const { bundle } = useGovernanceSpecBundle(appId);

  useEffect(() => {
    if (bundle) {
      setPreviewMode("plan");
      setIsPreviewOpen(true);
      return;
    }
    if (appId == null) {
      return;
    }
    const id = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.governance.specBundle({ appId }),
      });
    }, 500);
    return () => clearInterval(id);
  }, [bundle, appId, queryClient, setPreviewMode, setIsPreviewOpen]);

  const parts = [
    title ?? "Spec submitted for approval",
    stories ? `${stories} stories` : null,
    criteria ? `${criteria} criteria` : null,
  ].filter(Boolean);

  return (
    <div
      className="my-4 border rounded-lg bg-primary/5 border-primary/20 px-4 py-3 flex items-center gap-2"
      data-debug-bundle={bundle ? "loaded" : "none"}
    >
      <ScrollText className="text-primary" size={18} />
      <span className="font-semibold text-foreground">{parts.join(" — ")}</span>
    </div>
  );
};
