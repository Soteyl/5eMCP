/**
 * Behavioral tests for 2024 class and class feature access.
 * Named after realistic user intents.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEntry } from "../../src/search/get-entry.js";
import { searchContentType } from "../../src/search/index.js";

vi.mock("../../src/manifest/refresh.js", () => ({
  getManifest: vi.fn(),
}));

vi.mock("../../src/cache/index.js", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/github.js", () => ({
  fetchRaw: vi.fn(),
}));

import { getManifest } from "../../src/manifest/refresh.js";
import { fetchRaw } from "../../src/github.js";

const mockGetManifest = vi.mocked(getManifest);
const mockFetchRaw = vi.mocked(fetchRaw);

const WIZARD_CLASS_FILE = {
  class: [
    {
      name: "Wizard",
      source: "PHB",
      edition: "classic",
      hd: { number: 1, faces: 6 },
      spellcastingAbility: "int",
      classFeatures: [
        "Spellcasting|Wizard|PHB|1",
        "Arcane Recovery|Wizard|PHB|1",
        "Arcane Tradition|Wizard|PHB|2",
      ],
    },
    {
      name: "Wizard",
      source: "XPHB",
      edition: "one",
      hd: { number: 1, faces: 6 },
      spellcastingAbility: "int",
      classFeatures: [
        "Spellcasting|Wizard|XPHB|1",
        "Ritual Adept|Wizard|XPHB|1",
        "Arcane Recovery|Wizard|XPHB|1",
        "Scholar|Wizard|XPHB|2",
        "Spell Mastery|Wizard|XPHB|18",
      ],
    },
  ],
  subclass: [
    {
      name: "School of Abjuration",
      shortName: "Abjuration",
      source: "PHB",
      edition: "classic",
      className: "Wizard",
      classSource: "PHB",
    },
    {
      name: "Abjurer",
      shortName: "Abjurer",
      source: "XPHB",
      edition: "one",
      className: "Wizard",
      classSource: "XPHB",
    },
    {
      name: "Evoker",
      shortName: "Evoker",
      source: "XPHB",
      edition: "one",
      className: "Wizard",
      classSource: "XPHB",
    },
  ],
  classFeature: [
    { name: "Spellcasting", source: "PHB", classSource: "PHB", className: "Wizard", level: 1, entries: ["PHB spellcasting rules."] },
    { name: "Arcane Recovery", source: "PHB", classSource: "PHB", className: "Wizard", level: 1, entries: ["PHB arcane recovery."] },
    { name: "Spellcasting", source: "XPHB", classSource: "XPHB", className: "Wizard", level: 1, entries: ["XPHB spellcasting rules."] },
    { name: "Ritual Adept", source: "XPHB", classSource: "XPHB", className: "Wizard", level: 1, entries: ["Cast rituals without preparing them."] },
    { name: "Arcane Recovery", source: "XPHB", classSource: "XPHB", className: "Wizard", level: 1, entries: ["XPHB arcane recovery."] },
    { name: "Scholar", source: "XPHB", classSource: "XPHB", className: "Wizard", level: 2, entries: ["Gain expertise in two skills."] },
    { name: "Spell Mastery", source: "XPHB", classSource: "XPHB", className: "Wizard", level: 18, entries: ["Cast certain spells at will."] },
  ],
  subclassFeature: [
    { name: "Abjurer", source: "XPHB", classSource: "XPHB", className: "Wizard", subclassShortName: "Abjurer", level: 3, entries: ["You specialize in abjuration magic."] },
    { name: "Arcane Ward", source: "XPHB", classSource: "XPHB", className: "Wizard", subclassShortName: "Abjurer", level: 3, entries: ["You weave magic around yourself for protection."] },
    { name: "Projected Ward", source: "XPHB", classSource: "XPHB", className: "Wizard", subclassShortName: "Abjurer", level: 6, entries: ["When a creature you can see is hit, you can use your reaction."] },
    { name: "Evoker", source: "XPHB", classSource: "XPHB", className: "Wizard", subclassShortName: "Evoker", level: 3, entries: ["You specialize in evocation magic."] },
  ],
};

const MANIFEST_2024 = {
  ruleset: "2024" as const,
  built_at: Date.now(),
  content: {
    class: [
      { name: "class-wizard.json", path: "class/class-wizard.json", url: "https://raw.example.com/class-wizard.json", sha: "wiz1" },
    ],
    subclass: [],
  },
  homebrew: {},
};

const MANIFEST_2014 = { ...MANIFEST_2024, ruleset: "2014" as const };

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── Scenario: "Tell me about the 2024 Wizard class" ────────────────────────

describe("user intent: get the 2024 Wizard class", () => {
  it("class_get returns XPHB Wizard with 2024 rules", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2024") as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.source).toBe("XPHB");
  });

  it("class_get for 2024 wizard includes resolvedFeatures with XPHB content", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2024") as Record<string, unknown>;
    const features = result.resolvedFeatures as Record<string, unknown>[];
    expect(features.some((f) => f.name === "Ritual Adept")).toBe(true);
    expect(features.some((f) => f.name === "Scholar")).toBe(true);
    // PHB-only features should not appear
    expect(features.every((f) => f.source !== "PHB")).toBe(true);
  });

  it("class_get for 2024 wizard does not return PHB wizard", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2024") as Record<string, unknown>;
    expect(result.source).not.toBe("PHB");
  });
});

// ─── Scenario: "Tell me about the 2014 Wizard class" ────────────────────────

describe("user intent: get the 2014 Wizard class", () => {
  it("class_get returns PHB Wizard with 2014 rules", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2014 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2014") as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.source).toBe("PHB");
  });

  it("class_get for 2014 wizard resolvedFeatures has only PHB features", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2014 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2014") as Record<string, unknown>;
    const features = result.resolvedFeatures as Record<string, unknown>[];
    expect(features.every((f) => f.source === "PHB")).toBe(true);
  });
});

// ─── Scenario: "What are the Wizard's level 1 features in 2024?" ─────────────

describe("user intent: find wizard class features at a specific level", () => {
  it("classfeature_search returns Spellcasting and Arcane Recovery for Wizard level 1", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const results = await searchContentType("classfeatures", "wizard", "2024", 20, { level: 1 });
    const names = results.map((r) => r.name);
    expect(names).toContain("Spellcasting");
    expect(names).toContain("Arcane Recovery");
    expect(names).toContain("Ritual Adept");
    // Scholar is level 2, should not appear
    expect(names).not.toContain("Scholar");
  });
});

// ─── Scenario: "What 2024 Wizard subclasses are available?" ─────────────────

describe("user intent: find all Wizard subclasses for 2024", () => {
  it("subclass_search returns XPHB subclasses from class files", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const results = await searchContentType("subclass", "wizard", "2024");
    const names = results.map((r) => r.name);
    expect(names).toContain("Abjurer");
    expect(names).toContain("Evoker");
  });

  it("subclass_search returns both editions when both exist in file", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const results = await searchContentType("subclass", "abjur", "2024");
    const names = results.map((r) => r.name);
    // Both PHB and XPHB abjuration subclasses match
    expect(names).toContain("Abjurer");
    expect(names).toContain("School of Abjuration");
  });
});

// ─── Scenario: "Tell me about the Abjurer subclass in 2024" ─────────────────

describe("user intent: get the 2024 Abjurer subclass", () => {
  it("subclass_get returns XPHB Abjurer when ruleset=2024", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const result = await getEntry("subclass", "Abjurer", undefined, "2024") as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.source).toBe("XPHB");
    expect(result.edition).toBe("one");
  });
});

// ─── Scenario: "What does Arcane Ward do?" ──────────────────────────────────

describe("user intent: look up a specific subclass feature", () => {
  it("subclassfeature_search finds Arcane Ward", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const results = await searchContentType("subclassfeatures", "arcane ward", "2024");
    expect(results.length).toBeGreaterThan(0);
    const ward = results.find((r) => r.name === "Arcane Ward") as Record<string, unknown> | undefined;
    expect(ward).toBeDefined();
    expect(ward?.entries).toBeDefined();
  });
});

// ─── Scenario: "What are all the Abjurer's features?" ───────────────────────

describe("user intent: list all features of the Abjurer subclass", () => {
  it("subclassfeature_search for Abjurer returns all its features", async () => {
    mockGetManifest.mockResolvedValue(MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(WIZARD_CLASS_FILE);
    const results = await searchContentType("subclassfeatures", "abjurer", "2024");
    const names = results.map((r) => r.name);
    expect(names).toContain("Arcane Ward");
    expect(names).toContain("Projected Ward");
    // Evoker features should not appear when searching "abjurer"
    expect(names).not.toContain("Evoker");
  });
});
