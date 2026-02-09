import { tool } from "ai";
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { VirtualFileSystem } from "../file-system";

interface ToolResult {
  success: boolean;
  message?: string;
  error?: string;
}

const fileManagerSchema = z.object({
  command: z.enum(["rename", "delete"]).describe("The operation to perform"),
  path: z.string().describe("The path to the file or directory to rename or delete"),
  new_path: z
    .string()
    .optional()
    .describe("The new path. Only provide when renaming or moving a file."),
});

const DESCRIPTION =
  'Rename or delete files or folders in the file system. Rename can be used to "move" a file. Rename will recursively create folders as required.';

function executeFileManagerCommand(
  fileSystem: VirtualFileSystem,
  { command, path, new_path }: z.infer<typeof fileManagerSchema>
): ToolResult {
  switch (command) {
    case "rename": {
      if (!new_path) {
        return { success: false, error: "new_path is required for rename command" };
      }
      const success = fileSystem.rename(path, new_path);
      return success
        ? { success: true, message: `Successfully renamed ${path} to ${new_path}` }
        : { success: false, error: `Failed to rename ${path} to ${new_path}` };
    }
    case "delete": {
      const success = fileSystem.deleteFile(path);
      return success
        ? { success: true, message: `Successfully deleted ${path}` }
        : { success: false, error: `Failed to delete ${path}` };
    }
  }
}

export function buildFileManagerTool(fileSystem: VirtualFileSystem) {
  return tool({
    description: DESCRIPTION,
    parameters: fileManagerSchema,
    execute: async (args) => executeFileManagerCommand(fileSystem, args),
  });
}

export function buildFileManagerLangChainTool(fileSystem: VirtualFileSystem) {
  // @ts-expect-error - DynamicStructuredTool has deep type instantiation with complex Zod schemas
  return new DynamicStructuredTool({
    name: "file_manager",
    description: DESCRIPTION,
    schema: fileManagerSchema,
    func: async (args) => JSON.stringify(executeFileManagerCommand(fileSystem, args)),
  });
}
