import type { Ruleset } from "../types.js";

export interface ManifestFile {
  name: string;
  path: string;
  url: string;
  sha: string;
  source?: string;
  fluff_url?: string;
  fluff_sha?: string;
}

export interface Manifest {
  ruleset: Ruleset;
  built_at: number;
  content: Record<string, ManifestFile[]>;
  homebrew: Record<string, ManifestFile[]>;
  /**
   * Prerelease (Unearthed Arcana) content, populated only in local mode when
   * LOCAL_PRERELEASE_DIR is set. Keyed by JSON content key (e.g. "spell",
   * "subclass", "subclassFeature") rather than by folder, because each UA file
   * bundles many content types — the same file appears under every key it holds.
   */
  prerelease?: Record<string, ManifestFile[]>;
}
