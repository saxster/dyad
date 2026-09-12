import { z } from "zod";

export const EarsCriterionSchema = z.object({
  id: z.string(),
  given: z.string(),
  when: z.string(),
  then: z.string(),
  verificationContract: z.string().optional(),
});

export type EarsCriterion = z.infer<typeof EarsCriterionSchema>;

export const UserStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  narrative: z.string(),
  criteria: z.array(EarsCriterionSchema),
  priority: z.enum(["must", "should", "could", "wont"]).optional(),
});

export type UserStory = z.infer<typeof UserStorySchema>;
