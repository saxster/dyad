import { describe, it, expect } from "vitest";
import { aggregateVerdict, type MemberReport } from "./verdict_aggregator";

const criticalFinding = (claim: string) => ({
  severity: "critical" as const,
  claim,
  evidence: "e",
});
const minorFinding = (claim: string) => ({
  severity: "minor" as const,
  claim,
  evidence: "e",
});

describe("aggregateVerdict", () => {
  it("classifies unanimous / majority / contested verdicts", () => {
    const fourCritical: MemberReport[] = [
      { memberId: "m1", findings: [criticalFinding("c1")] },
      { memberId: "m2", findings: [criticalFinding("c2")] },
      { memberId: "m3", findings: [criticalFinding("c3")] },
      { memberId: "m4", findings: [criticalFinding("c4")] },
    ];
    expect(aggregateVerdict(fourCritical)).toEqual({
      classification: "unanimous-critical",
      consensusScore: 1,
      critiques: fourCritical,
    });

    const threeFailOnePass: MemberReport[] = [
      { memberId: "m1", findings: [criticalFinding("c1")] },
      { memberId: "m2", findings: [criticalFinding("c2")] },
      { memberId: "m3", findings: [criticalFinding("c3")] },
      { memberId: "m4", findings: [minorFinding("n1")] },
    ];
    expect(aggregateVerdict(threeFailOnePass)).toEqual({
      classification: "majority-critical",
      consensusScore: 0.75,
      critiques: threeFailOnePass,
    });

    const twoFailTwoPass: MemberReport[] = [
      { memberId: "m1", findings: [criticalFinding("c1")] },
      { memberId: "m2", findings: [criticalFinding("c2")] },
      { memberId: "m3", findings: [minorFinding("n1")] },
      { memberId: "m4", findings: [minorFinding("n2")] },
    ];
    expect(aggregateVerdict(twoFailTwoPass)).toEqual({
      classification: "contested",
      consensusScore: 0.5,
      critiques: twoFailTwoPass,
    });

    const allMinorOnly: MemberReport[] = [
      { memberId: "m1", findings: [minorFinding("n1")] },
      { memberId: "m2", findings: [minorFinding("n2")] },
      { memberId: "m3", findings: [minorFinding("n3")] },
      { memberId: "m4", findings: [minorFinding("n4")] },
    ];
    expect(aggregateVerdict(allMinorOnly)).toEqual({
      classification: "unanimous-pass",
      consensusScore: 1,
      critiques: allMinorOnly,
    });
  });

  it("returns unavailable when there are no reports", () => {
    expect(aggregateVerdict([])).toEqual({
      classification: "unavailable",
      consensusScore: 0,
      critiques: [],
    });
  });
});
