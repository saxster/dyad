import type { LocalAgentFixture } from "../../../../testing/fake-llm-server/localAgentTypes";

export const fixture: LocalAgentFixture = {
  description:
    "Governed verification flow: spec with a runnable contract, then a turn that satisfies it",
  turns: [
    {
      text: "I have enough context. Drafting the governed spec now.",
      toolCalls: [
        {
          name: "write_spec",
          args: {
            rawIntent: "Write a turn output file the spec can verify",
            stories: [
              {
                id: "US-1",
                title: "Write the verified file",
                narrative:
                  "As a user I want file1.txt written so that the verification contract passes",
                priority: "must",
                criteria: [
                  {
                    id: "AC-1",
                    given: "the app dir exists",
                    when: "the turn completes",
                    then: "file1.txt is present",
                    verificationContract: "test -f file1.txt",
                  },
                ],
              },
            ],
            notDoingList: ["No localization"],
            risks: [
              {
                title: "missing file",
                description: "The file could be written to the wrong path",
                likelihood: "Low",
                impact: "Low",
                mitigation: "Write relative to the app root",
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
      text: "Writing the file required by the approved spec's contract.",
      toolCalls: [
        {
          name: "write_file",
          args: {
            path: "file1.txt",
            content: "governed turn output\n",
          },
        },
      ],
    },
    {
      text: "file1.txt is written; the turn-end verification should pass.",
    },
  ],
};
