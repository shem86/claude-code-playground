import { describe, test, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/agents/save-project", () => ({
  saveProjectState: vi.fn(),
}));

import { formatConversationHistory } from "../real-flow";

function msg(role: string, content: string, id?: string) {
  return { id: id || `${role}-${Math.random().toString(36).slice(2)}`, role, content };
}

describe("formatConversationHistory", () => {
  test("returns empty string for empty messages", () => {
    expect(formatConversationHistory([])).toBe("");
  });

  test("returns empty string for null/undefined", () => {
    expect(formatConversationHistory(null as any)).toBe("");
    expect(formatConversationHistory(undefined as any)).toBe("");
  });

  test("returns empty string for single message (current request only)", () => {
    expect(formatConversationHistory([msg("user", "build a button")])).toBe("");
  });

  test("formats a simple user/assistant turn", () => {
    const messages = [
      msg("user", "build a counter"),
      msg("assistant", "Here is a counter component with increment/decrement.", "multi-agent-1"),
      msg("user", "make the button bigger"),
    ];

    const result = formatConversationHistory(messages);

    expect(result).toContain("[CONVERSATION HISTORY]");
    expect(result).toContain("[END CONVERSATION HISTORY]");
    expect(result).toContain("User: build a counter");
    expect(result).toContain("Assistant: Here is a counter component");
    expect(result).not.toContain("make the button bigger");
  });

  test("filters out assistant placeholders with workflow completed text", () => {
    const messages = [
      msg("user", "build a counter"),
      msg("assistant", "Multi-agent workflow completed.", "assistant-placeholder-1"),
      msg("assistant", "Actual useful output from agents.", "multi-agent-1"),
      msg("user", "next request"),
    ];

    const result = formatConversationHistory(messages);

    expect(result).not.toContain("Multi-agent workflow completed");
    expect(result).toContain("Actual useful output from agents.");
  });

  test("filters out error messages", () => {
    const messages = [
      msg("user", "build something"),
      msg("assistant", "Multi-agent workflow failed: timeout", "multi-agent-error-abc"),
      msg("user", "try again"),
    ];

    const result = formatConversationHistory(messages);

    expect(result).not.toContain("workflow failed");
  });

  test("truncates long assistant messages to 500 chars", () => {
    const longContent = "A".repeat(600);
    const messages = [
      msg("user", "build something"),
      msg("assistant", longContent, "multi-agent-1"),
      msg("user", "next"),
    ];

    const result = formatConversationHistory(messages);

    // Should contain truncated content with ellipsis
    expect(result).toContain("A".repeat(500) + "...");
    expect(result).not.toContain("A".repeat(501));
  });

  test("does not truncate assistant messages at or under 500 chars", () => {
    const content = "B".repeat(500);
    const messages = [
      msg("user", "build something"),
      msg("assistant", content, "multi-agent-1"),
      msg("user", "next"),
    ];

    const result = formatConversationHistory(messages);

    expect(result).toContain(content);
    expect(result).not.toContain("...");
  });

  test("caps at last 5 turns (10 messages)", () => {
    const messages: any[] = [];
    for (let i = 0; i < 8; i++) {
      messages.push(msg("user", `request ${i}`));
      messages.push(msg("assistant", `response ${i}`, `multi-agent-${i}`));
    }
    // Add the current request
    messages.push(msg("user", "current request"));

    const result = formatConversationHistory(messages);

    // Should NOT contain the earliest turns
    expect(result).not.toContain("request 0");
    expect(result).not.toContain("response 0");
    expect(result).not.toContain("request 1");
    expect(result).not.toContain("response 1");
    expect(result).not.toContain("request 2");

    // Should contain the last 5 turns (indices 3-7)
    expect(result).toContain("request 3");
    expect(result).toContain("response 3");
    expect(result).toContain("request 7");
    expect(result).toContain("response 7");

    // Should NOT contain the current request
    expect(result).not.toContain("current request");
  });

  test("skips messages with empty content", () => {
    const messages = [
      msg("user", "build something"),
      msg("assistant", "", "multi-agent-1"),
      msg("assistant", "   ", "multi-agent-2"),
      msg("user", "next"),
    ];

    const result = formatConversationHistory(messages);

    expect(result).toContain("User: build something");
    // Only the user message should be present, not empty assistant messages
    expect(result).not.toContain("Assistant: \n");
  });

  test("handles multiple turns correctly", () => {
    const messages = [
      msg("user", "build a login form"),
      msg("assistant", "Created a login form with email and password fields.", "multi-agent-1"),
      msg("user", "add validation"),
      msg("assistant", "Added email format validation and required field checks.", "multi-agent-2"),
      msg("user", "now add a forgot password link"),
    ];

    const result = formatConversationHistory(messages);

    expect(result).toContain("User: build a login form");
    expect(result).toContain("Assistant: Created a login form");
    expect(result).toContain("User: add validation");
    expect(result).toContain("Assistant: Added email format validation");
    expect(result).not.toContain("forgot password link");
  });
});
