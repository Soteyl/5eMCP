import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchContentType } from "../../src/search/index.js";
import { getEntry } from "../../src/search/get-entry.js";

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

// Realistic class file with both PHB (classic) and XPHB (one) editions
const CLASS_FILE = {
  class: [
    {
      name: "Wizard",
      source: "PHB",
      edition: "classic",
      hd: { number: 1, faces: 6 },
      classFeatures: ["Spellcasting|Wizard|PHB|1", "Arcane Recovery|Wizard|PHB|1"],
    },
    {
      name: "Wizard",
      source: "XPHB",
      edition: "one",
      hd: { number: 1, faces: 6 },
      classFeatures: ["Spellcasting|Wizard|XPHB|1", "Arcane Recovery|Wizard|XPHB|1"],
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
  ],
  classFeature: [
    {
      name: "Spellcasting",
      source: "PHB",
      classSource: "PHB",
      className: "Wizard",
      level: 1,
      entries: ["You can cast wizard spells (PHB)."],
    },
    {
      name: "Spellcasting",
      source: "XPHB",
      classSource: "XPHB",
      className: "Wizard",
      level: 1,
      entries: ["You can cast wizard spells (XPHB)."],
    },
    {
      name: "Arcane Recovery",
      source: "XPHB",
      classSource: "XPHB",
      className: "Wizard",
      level: 1,
      entries: ["Once per day, you can recover spell slots."],
    },
  ],
  subclassFeature: [
    {
      name: "Abjurer",
      source: "XPHB",
      classSource: "XPHB",
      className: "Wizard",
      subclassShortName: "Abjurer",
      level: 3,
      entries: ["You become an abjurer."],
    },
    {
      name: "Arcane Ward",
      source: "XPHB",
      classSource: "XPHB",
      className: "Wizard",
      subclassShortName: "Abjurer",
      level: 3,
      entries: ["You weave magic around yourself for protection."],
    },
  ],
};

const CLASS_FILE_ONLY_ONE_EDITION = {
  class: [
    {
      name: "Artificer",
      source: "TCE",
      edition: "classic",
      hd: { number: 1, faces: 8 },
      classFeatures: ["Magical Tinkering|Artificer|TCE|1"],
    },
  ],
  subclass: [],
  classFeature: [
    {
      name: "Magical Tinkering",
      source: "TCE",
      classSource: "TCE",
      className: "Artificer",
      level: 1,
      entries: ["At 1st level, you learn how to invest a spark of magic."],
    },
  ],
  subclassFeature: [],
};

const FAKE_MANIFEST_2024 = {
  ruleset: "2024" as const,
  built_at: Date.now(),
  content: {
    class: [
      {
        name: "class-wizard.json",
        path: "class/class-wizard.json",
        url: "https://raw.example.com/class-wizard.json",
        sha: "wiz1",
      },
    ],
    subclass: [],
  },
  homebrew: {},
};

const FAKE_MANIFEST_2014 = {
  ...FAKE_MANIFEST_2024,
  ruleset: "2014" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Bug 1: edition-aware class_get ───────────────────────────────────────────

describe("getEntry class — edition-aware selection", () => {
  it("returns XPHB wizard when ruleset=2024 (edition: one)", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2024");
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).source).toBe("XPHB");
  });

  it("returns PHB wizard when ruleset=2014 (edition: classic)", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2014 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2014");
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).source).toBe("PHB");
  });

  it("returns the only available entry when preferred edition is not present", async () => {
    mockGetManifest.mockResolvedValue({
      ...FAKE_MANIFEST_2024,
      content: {
        class: [{ name: "class-artificer.json", path: "", url: "https://raw.example.com/class-artificer.json", sha: "art1" }],
        subclass: [],
      },
    } as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE_ONLY_ONE_EDITION);
    const result = await getEntry("class", "Artificer", undefined, "2024");
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).name).toBe("Artificer");
  });

  it("returns null when class not found at all", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("class", "Paladin", undefined, "2024");
    expect(result).toBeNull();
  });
});

// ── Bug 2: resolvedFeatures ──────────────────────────────────────────────────

describe("getEntry class — resolvedFeatures", () => {
  it("attaches resolvedFeatures array to the class entry", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2024") as Record<string, unknown>;
    expect(Array.isArray(result.resolvedFeatures)).toBe(true);
  });

  it("resolvedFeatures for 2024 wizard contains only XPHB features", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2024") as Record<string, unknown>;
    const features = result.resolvedFeatures as Record<string, unknown>[];
    expect(features.length).toBeGreaterThan(0);
    for (const f of features) {
      expect(f.source).toBe("XPHB");
    }
  });

  it("resolvedFeatures includes Spellcasting and Arcane Recovery for XPHB wizard", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2024") as Record<string, unknown>;
    const names = (result.resolvedFeatures as Record<string, unknown>[]).map((f) => f.name);
    expect(names).toContain("Spellcasting");
    expect(names).toContain("Arcane Recovery");
  });

  it("resolvedFeatures for 2014 wizard contains only PHB features", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2014 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2014") as Record<string, unknown>;
    const features = result.resolvedFeatures as Record<string, unknown>[];
    expect(features.length).toBeGreaterThan(0);
    for (const f of features) {
      expect(f.source).toBe("PHB");
    }
  });

  it("each resolvedFeature has level and entries fields", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("class", "Wizard", undefined, "2024") as Record<string, unknown>;
    for (const f of result.resolvedFeatures as Record<string, unknown>[]) {
      expect(f).toHaveProperty("level");
      expect(f).toHaveProperty("entries");
    }
  });

  it("resolvedFeatures is sorted by level ascending", async () => {
    mockGetManifest.mockResolvedValue({
      ...FAKE_MANIFEST_2024,
      content: {
        class: [{ name: "class-wizard.json", path: "", url: "https://raw.example.com/class-wizard.json", sha: "wiz1" }],
        subclass: [],
      },
    } as never);
    const fileWithMultipleLevels = {
      ...CLASS_FILE,
      classFeature: [
        { name: "Epic Boon", source: "XPHB", classSource: "XPHB", className: "Wizard", level: 19, entries: ["Gain a boon."] },
        { name: "Spellcasting", source: "XPHB", classSource: "XPHB", className: "Wizard", level: 1, entries: ["Cast spells."] },
        { name: "Scholar", source: "XPHB", classSource: "XPHB", className: "Wizard", level: 2, entries: ["Expertise."] },
      ],
    };
    mockFetchRaw.mockResolvedValue(fileWithMultipleLevels);
    const result = await getEntry("class", "Wizard", undefined, "2024") as Record<string, unknown>;
    const levels = (result.resolvedFeatures as Record<string, unknown>[]).map((f) => f.level as number);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });
});

// ── Bug 3a: subclass lookup via MANIFEST_FOLDER_MAP ──────────────────────────

describe("searchContentType subclass — uses class files via MANIFEST_FOLDER_MAP", () => {
  it("finds subclasses even though manifest.content.subclass is empty", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("subclass", "abjurer", "2024");
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((r) => r.name)).toContain("Abjurer");
  });

  it("returns School of Abjuration when searching 'abjuration'", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("subclass", "abjuration", "2024");
    const names = results.map((r) => r.name);
    expect(names).toContain("School of Abjuration");
  });

  it("returns subclasses for a class name query", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("subclass", "wizard", "2024");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect((r as Record<string, unknown>).className).toBe("Wizard");
    }
  });
});

describe("getEntry subclass — uses class files via MANIFEST_FOLDER_MAP", () => {
  it("finds Abjurer subclass by name", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("subclass", "Abjurer", undefined, "2024");
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).name).toBe("Abjurer");
  });

  it("returns XPHB Abjurer (edition: one) for ruleset=2024", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("subclass", "Abjurer", undefined, "2024");
    expect((result as Record<string, unknown>).source).toBe("XPHB");
  });

  it("returns PHB School of Abjuration for ruleset=2014", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2014 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("subclass", "School of Abjuration", undefined, "2014");
    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).source).toBe("PHB");
  });

  it("returns null when subclass not found", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const result = await getEntry("subclass", "Nonexistent Subclass", undefined, "2024");
    expect(result).toBeNull();
  });
});

// ── Bug 3b: classfeatures / subclassfeatures search ─────────────────────────

describe("searchContentType classfeatures — uses class files via MANIFEST_FOLDER_MAP", () => {
  it("finds class features by name", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("classfeatures", "arcane recovery", "2024");
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((r) => r.name)).toContain("Arcane Recovery");
  });

  it("finds features by class name", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("classfeatures", "wizard", "2024");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect((r as Record<string, unknown>).className).toBe("Wizard");
    }
  });

  it("returns empty array for unknown feature name", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("classfeatures", "nonexistent feature xyz", "2024");
    expect(results).toHaveLength(0);
  });

  it("level filter works for class features", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("classfeatures", "", "2024", 20, { level: 1 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect((r as Record<string, unknown>).level).toBe(1);
    }
  });
});

describe("searchContentType subclassfeatures — uses class files via MANIFEST_FOLDER_MAP", () => {
  it("finds subclass features by name", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("subclassfeatures", "arcane ward", "2024");
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((r) => r.name)).toContain("Arcane Ward");
  });

  it("finds subclass features by subclass name", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("subclassfeatures", "abjurer", "2024");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect((r as Record<string, unknown>).subclassShortName).toBe("Abjurer");
    }
  });

  it("finds subclass features by class name", async () => {
    mockGetManifest.mockResolvedValue(FAKE_MANIFEST_2024 as never);
    mockFetchRaw.mockResolvedValue(CLASS_FILE);
    const results = await searchContentType("subclassfeatures", "wizard", "2024");
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect((r as Record<string, unknown>).className).toBe("Wizard");
    }
  });
});
