import { describe, it, expect } from "vitest";
import { createServer } from "../../src/server.js";

describe("5eMCP prompt (/5eMCP slash command)", () => {
  it("registers a prompt named '5eMCP'", () => {
    const server = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompts = (server as any)._registeredPrompts as Record<string, unknown>;
    expect(prompts["5eMCP"]).toBeDefined();
  });

  it("prompt has a description", () => {
    const server = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompts = (server as any)._registeredPrompts as Record<string, { description?: string }>;
    expect(typeof prompts["5eMCP"].description).toBe("string");
    expect((prompts["5eMCP"].description ?? "").length).toBeGreaterThan(10);
  });

  it("prompt callback returns messages array", async () => {
    const server = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompts = (server as any)._registeredPrompts as Record<string, { callback: (...args: unknown[]) => Promise<unknown> }>;
    const result = await prompts["5eMCP"].callback({}) as { messages: unknown[] };
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("prompt message has role:user and text content", async () => {
    const server = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompts = (server as any)._registeredPrompts as Record<string, { callback: (...args: unknown[]) => Promise<unknown> }>;
    const result = await prompts["5eMCP"].callback({}) as { messages: { role: string; content: { type: string; text: string } }[] };
    const msg = result.messages[0];
    expect(msg.role).toBe("user");
    expect(msg.content.type).toBe("text");
    expect(msg.content.text.length).toBeGreaterThan(200);
  });

  it("prompt text mentions omnisearch as the starting point", async () => {
    const server = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompts = (server as any)._registeredPrompts as Record<string, { callback: (...args: unknown[]) => Promise<unknown> }>;
    const result = await prompts["5eMCP"].callback({}) as { messages: { content: { text: string } }[] };
    expect(result.messages[0].content.text).toContain("omnisearch");
  });

  it("prompt text covers class_get and resolvedFeatures", async () => {
    const server = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompts = (server as any)._registeredPrompts as Record<string, { callback: (...args: unknown[]) => Promise<unknown> }>;
    const result = await prompts["5eMCP"].callback({}) as { messages: { content: { text: string } }[] };
    const text = result.messages[0].content.text;
    expect(text).toContain("class_get");
    expect(text).toContain("resolvedFeatures");
    expect(text).toContain("classfeature_search");
  });

  it("prompt text covers ruleset differences", async () => {
    const server = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompts = (server as any)._registeredPrompts as Record<string, { callback: (...args: unknown[]) => Promise<unknown> }>;
    const result = await prompts["5eMCP"].callback({}) as { messages: { content: { text: string } }[] };
    const text = result.messages[0].content.text;
    expect(text).toContain("2024");
    expect(text).toContain("2014");
  });

  it("prompt text covers the DM calculator tools", async () => {
    const server = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prompts = (server as any)._registeredPrompts as Record<string, { callback: (...args: unknown[]) => Promise<unknown> }>;
    const result = await prompts["5eMCP"].callback({}) as { messages: { content: { text: string } }[] };
    const text = result.messages[0].content.text;
    expect(text).toContain("cr_calculate");
    expect(text).toContain("encounter_build");
    expect(text).toContain("loot_generate");
  });
});
