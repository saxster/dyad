import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationBadgeProps {
  verified: boolean;
  green: number;
  red: number;
  failing: string[];
}

export function VerificationBadge({
  verified,
  green,
  red,
  failing,
}: VerificationBadgeProps) {
  return (
    <span
      data-testid="verification-badge"
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        verified ? "text-green-600" : "text-red-600",
      )}
    >
      {verified ? (
        <CheckCircle2
          role="img"
          aria-label="verified"
          className="h-3.5 w-3.5"
        />
      ) : (
        <XCircle role="img" aria-label="not verified" className="h-3.5 w-3.5" />
      )}
      <span>
        {green}/{green + red} criteria green
      </span>
      {failing.map((key) => (
        <span key={key}>{key}</span>
      ))}
    </span>
  );
}
