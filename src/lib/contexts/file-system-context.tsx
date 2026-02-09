"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { VirtualFileSystem, FileNode } from "@/lib/file-system";

interface ToolCall {
  toolName: string;
  args: any;
}

interface FileSystemContextType {
  fileSystem: VirtualFileSystem;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  createFile: (path: string, content?: string) => void;
  updateFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => boolean;
  getFileContent: (path: string) => string | null;
  getAllFiles: () => Map<string, string>;
  refreshTrigger: number;
  refreshFileSystem: () => void;
  handleToolCall: (toolCall: ToolCall) => void;
  reset: () => void;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function FileSystemProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: Record<string, any>;
}) {
  const [fileSystem] = useState(() => {
    const fs = new VirtualFileSystem();
    if (initialData) {
      fs.deserializeFromNodes(initialData);
    }
    return fs;
  });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      const files = fileSystem.getAllFiles();

      // Check if App.jsx exists
      if (files.has("/App.jsx")) {
        setSelectedFile("/App.jsx");
      } else {
        // Find first file in root directory
        const rootFiles = Array.from(files.keys())
          .filter((path) => {
            const parts = path.split("/").filter(Boolean);
            return parts.length === 1; // Root level file
          })
          .sort();

        if (rootFiles.length > 0) {
          setSelectedFile(rootFiles[0]);
        }
      }
    }
  }, [selectedFile, fileSystem, refreshTrigger]);

  const createFile = useCallback(
    (path: string, content: string = "") => {
      fileSystem.createFile(path, content);
      triggerRefresh();
    },
    [fileSystem, triggerRefresh]
  );

  const updateFile = useCallback(
    (path: string, content: string) => {
      fileSystem.updateFile(path, content);
      triggerRefresh();
    },
    [fileSystem, triggerRefresh]
  );

  const deleteFile = useCallback(
    (path: string) => {
      fileSystem.deleteFile(path);
      if (selectedFile === path) {
        setSelectedFile(null);
      }
      triggerRefresh();
    },
    [fileSystem, selectedFile, triggerRefresh]
  );

  const renameFile = useCallback(
    (oldPath: string, newPath: string): boolean => {
      const success = fileSystem.rename(oldPath, newPath);
      if (success) {
        // Update selected file if it was renamed
        if (selectedFile === oldPath) {
          setSelectedFile(newPath);
        } else if (selectedFile && selectedFile.startsWith(oldPath + "/")) {
          // Update selected file if it's inside a renamed directory
          const relativePath = selectedFile.substring(oldPath.length);
          setSelectedFile(newPath + relativePath);
        }
        triggerRefresh();
      }
      return success;
    },
    [fileSystem, selectedFile, triggerRefresh]
  );

  const getFileContent = useCallback(
    (path: string) => {
      return fileSystem.readFile(path);
    },
    [fileSystem]
  );

  const getAllFiles = useCallback(() => {
    return fileSystem.getAllFiles();
  }, [fileSystem]);

  const reset = useCallback(() => {
    fileSystem.reset();
    setSelectedFile(null);
    triggerRefresh();
  }, [fileSystem, triggerRefresh]);

  const syncFileAfterEdit = useCallback(
    (path: string, result: string) => {
      if (result.startsWith("Error:")) return;
      const content = fileSystem.readFile(path);
      if (content !== null) {
        updateFile(path, content);
      }
    },
    [fileSystem, updateFile]
  );

  const handleStrReplaceEditor = useCallback(
    (args: any) => {
      const { command, path, file_text, old_str, new_str, insert_line } = args;

      switch (command) {
        case "create":
          if (path && file_text !== undefined) {
            const result = fileSystem.createFileWithParents(path, file_text);
            if (!result.startsWith("Error:")) {
              createFile(path, file_text);
            }
          }
          break;
        case "str_replace":
          if (path && old_str !== undefined && new_str !== undefined) {
            syncFileAfterEdit(path, fileSystem.replaceInFile(path, old_str, new_str));
          }
          break;
        case "insert":
          if (path && new_str !== undefined && insert_line !== undefined) {
            syncFileAfterEdit(path, fileSystem.insertInFile(path, insert_line, new_str));
          }
          break;
      }
    },
    [fileSystem, createFile, syncFileAfterEdit]
  );

  const handleFileManager = useCallback(
    (args: any) => {
      const { command, path, new_path } = args;

      switch (command) {
        case "rename":
          if (path && new_path) {
            renameFile(path, new_path);
          }
          break;
        case "delete":
          if (path) {
            const success = fileSystem.deleteFile(path);
            if (success) {
              deleteFile(path);
            }
          }
          break;
      }
    },
    [fileSystem, renameFile, deleteFile]
  );

  const handleToolCall = useCallback(
    (toolCall: ToolCall) => {
      const { toolName, args } = toolCall;
      if (!args) return;

      if (toolName === "str_replace_editor") {
        handleStrReplaceEditor(args);
      } else if (toolName === "file_manager") {
        handleFileManager(args);
      }
    },
    [handleStrReplaceEditor, handleFileManager]
  );

  return (
    <FileSystemContext.Provider
      value={{
        fileSystem,
        selectedFile,
        setSelectedFile,
        createFile,
        updateFile,
        deleteFile,
        renameFile,
        getFileContent,
        getAllFiles,
        refreshTrigger,
        refreshFileSystem: triggerRefresh,
        handleToolCall,
        reset,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
}

export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error("useFileSystem must be used within a FileSystemProvider");
  }
  return context;
}
