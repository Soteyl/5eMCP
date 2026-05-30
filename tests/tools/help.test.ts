import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHelpTool } from "../../src/tools/help.js";

function makeServer() {
  const tools: Record<string, Parameters<McpServer["tool"]>> = {};
  const server = {
    tool: vi.fn((...args: Parameters<McpServer["tool"]>) => {
      const name = args[0] as string;
      tools[name] = args;
    }),
  } as unknown as McpServer;
  return { server, tools };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerHelpTool", () => {
  it("registers a help tool", () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    expect(tools["help"]).toBeDefined();
  });

  it("help tool returns valid JSON text", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    expect((result as { content: { type: string; text: string }[] }).content[0].type).toBe("text");
    expect(() =>
      JSON.parse((result as { content: { type: string; text: string }[] }).content[0].text),
    ).not.toThrow();
  });

  it("help response has quick_start section", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    const parsed = JSON.parse((result as { content: { type: string; text: string }[] }).content[0].text);
    expect(parsed.quick_start).toBeDefined();
  });

  it("help response has tool_groups section", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    const parsed = JSON.parse((result as { content: { type: string; text: string }[] }).content[0].text);
    expect(parsed.tool_groups).toBeDefined();
  });

  it("quick_start mentions omnisearch for unknown types", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    const text = (result as { content: { type: string; text: string }[] }).content[0].text;
    expect(text).toContain("omnisearch");
  });

  it("quick_start mentions class_get for class feature lookups", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    const text = (result as { content: { type: string; text: string }[] }).content[0].text;
    expect(text).toContain("class_get");
  });

  it("help response documents classfeature_search and subclassfeature_search", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    const text = (result as { content: { type: string; text: string }[] }).content[0].text;
    expect(text).toContain("classfeature_search");
    expect(text).toContain("subclassfeature_search");
  });

  it("help response documents the DM calculator tools", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    const text = (result as { content: { type: string; text: string }[] }).content[0].text;
    expect(text).toContain("cr_calculate");
    expect(text).toContain("encounter_build");
    expect(text).toContain("loot_generate");
  });

  it("help response mentions fetch_content as a fallback", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    const text = (result as { content: { type: string; text: string }[] }).content[0].text;
    expect(text).toContain("fetch_content");
  });

  it("help response documents ruleset differences", async () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, , , handler] = tools["help"] as [string, string, unknown, () => Promise<unknown>];
    const result = await handler();
    const text = (result as { content: { type: string; text: string }[] }).content[0].text;
    expect(text).toContain("2024");
    expect(text).toContain("2014");
  });

  it("help tool description tells Claude to call it first when unsure", () => {
    const { server, tools } = makeServer();
    registerHelpTool(server);
    const [, description] = tools["help"] as [string, string, unknown, unknown];
    expect(typeof description).toBe("string");
    expect((description as string).length).toBeGreaterThan(20);
  });
});
