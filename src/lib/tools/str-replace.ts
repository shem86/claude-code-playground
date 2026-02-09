import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { VirtualFileSystem } from "@/lib/file-system";

const TextEditorParameters = z.object({
  command: z.enum(["view", "create", "str_replace", "insert", "undo_edit"]),
  path: z.string(),
  file_text: z.string().optional(),
  insert_line: z.number().optional(),
  new_str: z.string().optional(),
  old_str: z.string().optional(),
  view_range: z.array(z.number()).optional(),
});

const DESCRIPTION =
  "A text editor tool for viewing, creating, and editing files in the virtual filesystem. " +
  "Commands: 'view' (read file), 'create' (create new file), 'str_replace' (replace text), 'insert' (insert at line).";

function executeTextEditorCommand(
  fileSystem: VirtualFileSystem,
  {
    command,
    path,
    file_text,
    insert_line,
    new_str,
    old_str,
    view_range,
  }: z.infer<typeof TextEditorParameters>
): string {
  switch (command) {
    case "view":
      return fileSystem.viewFile(path, view_range as [number, number] | undefined);
    case "create":
      return fileSystem.createFileWithParents(path, file_text || "");
    case "str_replace":
      return fileSystem.replaceInFile(path, old_str || "", new_str || "");
    case "insert":
      return fileSystem.insertInFile(path, insert_line || 0, new_str || "");
    case "undo_edit":
      return "Error: undo_edit command is not supported. Use str_replace to revert changes.";
  }
}

export const buildStrReplaceTool = (fileSystem: VirtualFileSystem) => {
  return {
    id: "str_replace_editor" as const,
    args: {},
    parameters: TextEditorParameters,
    execute: async (args: z.infer<typeof TextEditorParameters>) =>
      executeTextEditorCommand(fileSystem, args),
  };
};

export function buildStrReplaceLangChainTool(fileSystem: VirtualFileSystem) {
  // @ts-expect-error - DynamicStructuredTool has deep type instantiation with complex Zod schemas
  return new DynamicStructuredTool({
    name: "str_replace_editor",
    description: DESCRIPTION,
    schema: TextEditorParameters,
    func: async (args) => executeTextEditorCommand(fileSystem, args),
  });
}
