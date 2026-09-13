export interface MemberFinding {
  severity: "critical" | "major" | "minor";
  claim: string;
  evidence: string;
}

export interface MemberReport {
  memberId: string;
  findings: MemberFinding[];
}

export type VerdictClassification =
  | "unanimous-critical"
  | "unanimous-pass"
  | "majority-critical"
  | "majority-pass"
  | "contested"
  | "unavailable";

export interface AggregatedVerdict {
  classification: VerdictClassification;
  consensusScore: number;
  critiques: MemberReport[];
}

export function aggregateVerdict(reports: MemberReport[]): AggregatedVerdict {
  if (reports.length === 0) {
    return { classification: "unavailable", consensusScore: 0, critiques: [] };
  }

  // A member fails the work iff any finding is critical or major.
  const failCount = reports.filter((report) =>
    report.findings.some(
      (finding) =>
        finding.severity === "critical" || finding.severity === "major",
    ),
  ).length;
  const passCount = reports.length - failCount;
  const consensusScore =
    Math.round((Math.max(failCount, passCount) / reports.length) * 100) / 100;

  let classification: VerdictClassification;
  if (failCount === reports.length) {
    classification = "unanimous-critical";
  } else if (passCount === reports.length) {
    classification = "unanimous-pass";
  } else if (failCount === passCount) {
    classification = "contested";
  } else {
    classification =
      failCount > passCount ? "majority-critical" : "majority-pass";
  }

  return { classification, consensusScore, critiques: reports };
}
