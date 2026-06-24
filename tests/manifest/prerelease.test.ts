import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildManifest } from "../../src/manifest/builder.js";

/**
 * Integration test for prerelease (Unearthed Arcana) indexing over a real
 * filesystem fixture. The UA repo lays out content-type dirs at its root and
 * each file bundles many content types, so the builder must key files by the
 * JSON content keys they actually contain, not by folder.
 */
describe("buildManifest prerelease indexing", () => {
  let dataRoot: string;
  let preRoot: string;
  const savedData = process.env.LOCAL_DATA_DIR;
  const savedPre = process.env.LOCAL_PRERELEASE_DIR;

  beforeAll(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), "5emcp-data-"));
    preRoot = await mkdtemp(join(tmpdir(), "5emcp-ua-"));

    // Minimal official data tree so the content build has something to read.
    await mkdir(join(dataRoot, "data", "spells"), { recursive: true });
    await writeFile(
      join(dataRoot, "data", "spells", "spells-phb.json"),
      JSON.stringify({ spell: [{ name: "Fireball", source: "PHB" }] }),
    );

    // A class-folder bundle holding several content types at once — mirrors the
    // real "Unearthed Arcana 2025 - Psion Update.json".
    await mkdir(join(preRoot, "class"), { recursive: true });
    await writeFile(
      join(preRoot, "class", "Unearthed Arcana 2025 - Psion Update.json"),
      JSON.stringify({
        class: [{ name: "Psion", source: "XUA2025PsionUpdate" }],
        subclass: [{ name: "Metamorph", source: "XUA2025PsionUpdate", className: "Psion" }],
        subclassFeature: [{ name: "Organic Weapons", source: "XUA2025PsionUpdate", level: 3 }],
        spell: [{ name: "Mind Sliver UA", source: "XUA2025PsionUpdate" }],
        vehicle: [], // empty arrays must NOT create a key
      }),
    );

    // A collection bundle with a monster, in a different content-type dir.
    await mkdir(join(preRoot, "collection"), { recursive: true });
    await writeFile(
      join(preRoot, "collection", "Some Collection.json"),
      JSON.stringify({ monster: [{ name: "Astral Dreadnought UA", source: "XUA" }] }),
    );

    // Tooling dirs prefixed with `_` or `.` must be skipped entirely.
    await mkdir(join(preRoot, "_generated"), { recursive: true });
    await writeFile(
      join(preRoot, "_generated", "index.json"),
      JSON.stringify({ spell: [{ name: "Should Not Be Indexed", source: "X" }] }),
    );
  });

  afterAll(async () => {
    await rm(dataRoot, { recursive: true, force: true });
    await rm(preRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    process.env.LOCAL_DATA_DIR = dataRoot;
    process.env.LOCAL_PRERELEASE_DIR = preRoot;
  });

  afterEach(() => {
    if (savedData === undefined) delete process.env.LOCAL_DATA_DIR;
    else process.env.LOCAL_DATA_DIR = savedData;
    if (savedPre === undefined) delete process.env.LOCAL_PRERELEASE_DIR;
    else process.env.LOCAL_PRERELEASE_DIR = savedPre;
  });

  it("keys bundle files by every content key they contain", async () => {
    const manifest = await buildManifest("2024");
    expect(manifest.prerelease).toBeDefined();
    const pre = manifest.prerelease!;

    for (const key of ["class", "subclass", "subclassFeature", "spell"]) {
      expect(pre[key], `expected prerelease key "${key}"`).toBeDefined();
      expect(pre[key].some((f) => f.path === "class/Unearthed Arcana 2025 - Psion Update.json")).toBe(true);
    }
  });

  it("indexes a content type bundled in a different folder (monster in collection/)", async () => {
    const manifest = await buildManifest("2024");
    const pre = manifest.prerelease!;
    expect(pre.monster).toBeDefined();
    expect(pre.monster.some((f) => f.path === "collection/Some Collection.json")).toBe(true);
  });

  it("does not create keys for empty arrays", async () => {
    const manifest = await buildManifest("2024");
    expect(manifest.prerelease!.vehicle).toBeUndefined();
  });

  it("skips tooling directories prefixed with _ or .", async () => {
    const manifest = await buildManifest("2024");
    const allPaths = Object.values(manifest.prerelease!).flat().map((f) => f.path);
    expect(allPaths.some((p) => p.startsWith("_generated/"))).toBe(false);
  });

  it("omits the prerelease section when LOCAL_PRERELEASE_DIR is unset", async () => {
    delete process.env.LOCAL_PRERELEASE_DIR;
    const manifest = await buildManifest("2024");
    expect(manifest.prerelease).toBeUndefined();
  });
});
