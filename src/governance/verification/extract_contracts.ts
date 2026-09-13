import type { UserStory } from "../core/spec_bundle_schemas";

export interface VerificationContract {
  key: string;
  command: string;
}

export interface CriterionRef {
  key: string;
}

export function extractContracts(bundle: { stories: UserStory[] }): {
  executable: VerificationContract[];
  manual: CriterionRef[];
} {
  const executable: VerificationContract[] = [];
  const manual: CriterionRef[] = [];

  for (const story of bundle.stories) {
    for (const criterion of story.criteria) {
      const key = `${story.id}/${criterion.id}`;
      if (criterion.verificationContract) {
        executable.push({ key, command: criterion.verificationContract });
      } else {
        manual.push({ key });
      }
    }
  }

  return { executable, manual };
}
