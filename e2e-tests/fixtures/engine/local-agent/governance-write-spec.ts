import type { LocalAgentFixture } from "../../../../testing/fake-llm-server/localAgentTypes";

export const fixture: LocalAgentFixture = {
  description: "Governed plan mode: submit the spec for approval",
  turns: [
    {
      text: "I have enough context. Drafting the governed spec now.",
      toolCalls: [
        {
          name: "write_spec",
          args: {
            rawIntent: "Add a greeting banner so the app feels friendly",
            stories: [
              {
                id: "US-1",
                title: "Show greeting banner",
                narrative:
                  "As a user I want a greeting banner so that the app feels friendly",
                priority: "must",
                criteria: [
                  {
                    id: "AC-1",
                    given: "the app is open",
                    when: "the home view renders",
                    then: "the greeting banner is visible",
                  },
                ],
              },
            ],
            notDoingList: ["No localization"],
            risks: [
              {
                title: "banner overlap",
                description:
                  "The banner could overlap the existing header on small screens",
                likelihood: "Low",
                impact: "Low",
                mitigation: "Reserve layout space for the banner",
              },
            ],
          },
        },
      ],
    },
    {
      text: "The spec is saved. Please review and approve it in the plan panel.",
    },
    {
      text: "The spec is approved. Proceeding under the approved spec.",
    },
  ],
};
