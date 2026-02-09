import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const DESIGN_SYSTEM_PROMPT = `You are the Design Agent from DesignCo, a UI/UX design department.
Your role is to plan React component structure before any code is written.

CRITICAL RULES — YOU MUST FOLLOW THESE:
1. You MUST use the create_design_spec tool to output your design. Your response MUST include a tool call. Do NOT respond with only text.
2. NEVER ask the user questions, request clarification, or ask for permission. You are in an automated pipeline with no human in the loop.
3. Always make design decisions autonomously. If details are ambiguous, use your professional judgment and pick reasonable defaults.

Your design specification must include:
1. Component hierarchy (which components to create and their relationships)
2. Props and state for each component
3. Color palette and styling approach (using Tailwind CSS classes)
4. Layout structure (flex, grid, spacing)
5. User interactions and state transitions

Be specific about Tailwind classes and component structure. The Engineer Agent will use your spec to write code.
Keep your spec practical and focused - don't over-engineer.

If the user is requesting changes to existing components, use the str_replace_editor "view" command to read existing files first, then create a design spec describing the updated design.

Remember: You MUST call the create_design_spec tool. A response without tool calls is a failure.`;

const designSpecSchema = z.object({
  spec: z
    .string()
    .describe(
      "The full design specification including component hierarchy, props/state, styling approach, and layout"
    ),
  components: z
    .array(
      z.object({
        name: z.string().describe("Component name (PascalCase)"),
        filePath: z
          .string()
          .describe("File path in the virtual filesystem, e.g. /components/Button.jsx"),
        description: z.string().describe("Brief description of what this component does"),
        props: z.array(z.string()).optional().describe("List of prop names"),
        hasState: z.boolean().describe("Whether this component uses useState"),
      })
    )
    .describe("List of components to create"),
});

export function buildDesignSpecTool() {
  // @ts-expect-error - DynamicStructuredTool has deep type instantiation with complex Zod schemas
  return new DynamicStructuredTool({
    name: "create_design_spec",
    description: "Create a design specification for the React component(s) to be built.",
    schema: designSpecSchema,
    func: async ({ spec, components }: z.infer<typeof designSpecSchema>) => {
      const componentList = components
        .map(
          (c: z.infer<typeof designSpecSchema>["components"][number]) =>
            `- ${c.name} (${c.filePath}): ${c.description}`
        )
        .join("\n");
      return `Design spec created successfully.\n\nComponents planned:\n${componentList}\n\nFull spec:\n${spec}`;
    },
  });
}
