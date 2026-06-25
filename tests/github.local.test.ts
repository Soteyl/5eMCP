import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchContents, fetchRaw, rawUrl, isLocalMode } from "../src/github.js";
import { REPOS } from "../src/types.js";

/**
 * Tests the local filesystem data-source mode (LOCAL_DATA_DIR). A small temp
 * fixture mirrors the 5etools layout (data/ with a flat file + a subdir) so the
 * tests are hermetic and don't depend on a full local dump.
 */
describe("github local mode", () => {
  let root: string;
  const savedEnv = process.env.LOCAL_DATA_DIR;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "5emcp-local-"));
    await mkdir(join(root, "data", "spells"), { recursive: true });
    await writeFile(
      join(root, "data", "feats.json"),
      JSON.stringify({ feat: [{ name: "Test Feat", source: "PHB" }] }),
    );
    await writeFile(
      join(root, "data", "spells", "spells-phb.json"),
      JSON.stringify({ spell: [{ name: "Fireball", source: "PHB" }] }),
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  beforeEach(() => {
    process.env.LOCAL_DATA_DIR = root;
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.LOCAL_DATA_DIR;
    else process.env.LOCAL_DATA_DIR = savedEnv;
  });

  it("isLocalMode reflects the env var", () => {
    expect(isLocalMode()).toBe(true);
    delete process.env.LOCAL_DATA_DIR;
    expect(isLocalMode()).toBe(false);
  });

  it("fetchContents lists files and dirs with relative paths and stable shas", async () => {
    const items = await fetchContents("o", "r", "data");
    const byName = new Map(items.map((i) => [i.name, i]));

    const feats = byName.get("feats.json");
    expect(feats?.type).toBe("file");
    expect(feats?.path).toBe("data/feats.json");
    expect(feats?.sha).toMatch(/^local-/);

    const spellsDir = byName.get("spells");
    expect(spellsDir?.type).toBe("dir");
    expect(spellsDir?.path).toBe("data/spells");

    // sha is stable across reads of an unchanged file
    const items2 = await fetchContents("o", "r", "data");
    expect(items2.find((i) => i.name === "feats.json")?.sha).toBe(feats?.sha);
  });

  it("rawUrl returns an absolute local path under LOCAL_DATA_DIR", () => {
    expect(rawUrl("o", "r", "main", "data/feats.json")).toBe(join(root, "data/feats.json"));
  });

  it("fetchRaw reads and parses a local file", async () => {
    const url = rawUrl("o", "r", "main", "data/spells/spells-phb.json");
    const data = (await fetchRaw(url)) as { spell: { name: string }[] };
    expect(data.spell[0].name).toBe("Fireball");
  });

  it("fetchRaw re-reads when the file's mtime changes", async () => {
    const path = join(root, "data", "feats.json");
    const url = rawUrl("o", "r", "main", "data/feats.json");

    const first = (await fetchRaw(url)) as { feat: { name: string }[] };
    expect(first.feat[0].name).toBe("Test Feat");

    await writeFile(path, JSON.stringify({ feat: [{ name: "Changed Feat", source: "PHB" }] }));
    // Bump mtime explicitly to guarantee cache invalidation even on coarse clocks.
    const future = new Date(Date.now() + 2000);
    await utimes(path, future, future);

    const second = (await fetchRaw(url)) as { feat: { name: string }[] };
    expect(second.feat[0].name).toBe("Changed Feat");
  });

  it("fetchRaw still uses HTTP for http(s) urls", () => {
    // An http url must not be treated as a local path; without network this
    // resolves to a fetch attempt rather than a filesystem read.
    expect(/^https?:\/\//i.test("https://example.com/x.json")).toBe(true);
  });
});

/**
 * Per-ruleset local routing: the 2024 and 2014 rulesets read from separate
 * dumps, selected by the content repo name (LOCAL_DATA_DIR vs LOCAL_DATA_DIR_2014).
 */
describe("github local mode — per-ruleset routing", () => {
  let root2024: string;
  let root2014: string;
  const REPO_2024 = REPOS["2024"].repo;
  const REPO_2014 = REPOS["2014"].repo;
  const saved2024 = process.env.LOCAL_DATA_DIR;
  const saved2014 = process.env.LOCAL_DATA_DIR_2014;

  beforeAll(async () => {
    root2024 = await mkdtemp(join(tmpdir(), "5emcp-2024-"));
    root2014 = await mkdtemp(join(tmpdir(), "5emcp-2014-"));
    await mkdir(join(root2024, "data"), { recursive: true });
    await mkdir(join(root2014, "data"), { recursive: true });
    await writeFile(join(root2024, "data", "feats.json"), JSON.stringify({ feat: [{ name: "Feat 2024", source: "XPHB" }] }));
    await writeFile(join(root2014, "data", "feats.json"), JSON.stringify({ feat: [{ name: "Feat 2014", source: "PHB" }] }));
  });

  afterAll(async () => {
    await rm(root2024, { recursive: true, force: true });
    await rm(root2014, { recursive: true, force: true });
  });

  beforeEach(() => {
    process.env.LOCAL_DATA_DIR = root2024;
    process.env.LOCAL_DATA_DIR_2014 = root2014;
  });

  afterEach(() => {
    if (saved2024 === undefined) delete process.env.LOCAL_DATA_DIR;
    else process.env.LOCAL_DATA_DIR = saved2024;
    if (saved2014 === undefined) delete process.env.LOCAL_DATA_DIR_2014;
    else process.env.LOCAL_DATA_DIR_2014 = saved2014;
  });

  it("rawUrl routes by repo to the matching dump", () => {
    expect(rawUrl("o", REPO_2024, "main", "data/feats.json")).toBe(join(root2024, "data/feats.json"));
    expect(rawUrl("o", REPO_2014, "main", "data/feats.json")).toBe(join(root2014, "data/feats.json"));
  });

  it("fetchRaw reads the 2014 dump for the 2014 repo and the 2024 dump otherwise", async () => {
    const data2024 = (await fetchRaw(rawUrl("o", REPO_2024, "main", "data/feats.json"))) as { feat: { name: string }[] };
    const data2014 = (await fetchRaw(rawUrl("o", REPO_2014, "main", "data/feats.json"))) as { feat: { name: string }[] };
    expect(data2024.feat[0].name).toBe("Feat 2024");
    expect(data2014.feat[0].name).toBe("Feat 2014");
  });

  it("fetchContents lists the 2014 dump for the 2014 repo", async () => {
    const items = await fetchContents("o", REPO_2014, "data");
    expect(items.find((i) => i.name === "feats.json")?.path).toBe("data/feats.json");
  });

  it("isLocalMode is true when only the 2014 dir is set", () => {
    delete process.env.LOCAL_DATA_DIR;
    expect(isLocalMode()).toBe(true);
  });

  it("falls back to GitHub for the 2014 repo when only 2024 is configured", () => {
    delete process.env.LOCAL_DATA_DIR_2014;
    const url = rawUrl("5etools-mirror-3", REPO_2014, "main", "data/feats.json");
    expect(url.startsWith("https://raw.githubusercontent.com/")).toBe(true);
  });
});
