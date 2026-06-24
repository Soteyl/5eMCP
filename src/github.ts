import { readFile, readdir, stat } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import type { GitHubContentsItem } from "./types.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

/**
 * Local data-source mode. When LOCAL_DATA_DIR is set, the server reads the
 * 5etools data tree from disk instead of GitHub — no network, no rate limits.
 * The directory must be the root of a 5etools dump (i.e. it contains `data/`).
 */
function localDataDir(): string | undefined {
  const dir = process.env.LOCAL_DATA_DIR;
  return dir && dir.trim() !== "" && !dir.startsWith("${") ? dir : undefined;
}

export function isLocalMode(): boolean {
  return localDataDir() !== undefined;
}

/**
 * Local prerelease (Unearthed Arcana) data source. When LOCAL_PRERELEASE_DIR is
 * set, the server also reads a clone of `TheGiddyLimit/unearthed-arcana` from
 * disk. That repo lays out content-type directories (class/, subclass/, spell/,
 * collection/, …) at its root — not under `data/` — and each JSON file bundles
 * many content types at once. Prerelease content is a local-mode-only feature.
 */
function localPrereleaseDir(): string | undefined {
  const dir = process.env.LOCAL_PRERELEASE_DIR;
  return dir && dir.trim() !== "" && !dir.startsWith("${") ? dir : undefined;
}

export function isPrereleaseAvailable(): boolean {
  return isLocalMode() && localPrereleaseDir() !== undefined;
}

/** Returns true only for a token that looks like a real PAT, not an empty string
 *  or an unresolved mcpb template variable like "${user_config.github_token}". */
function isValidToken(token: string | undefined): boolean {
  return !!token && token.trim() !== "" && !token.startsWith("${");
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "5eMCP/1.0.0",
    ...(isValidToken(token) ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Synthesizes a stable content hash from a file's mtime + size, so the
 *  SHA-keyed content cache invalidates whenever a local file changes. */
function localSha(mtimeMs: number, size: number): string {
  return `local-${Math.round(mtimeMs)}-${size}`;
}

async function fetchContentsLocal(path: string): Promise<GitHubContentsItem[]> {
  const base = localDataDir()!;
  const absDir = join(base, path);
  const dirents = await readdir(absDir, { withFileTypes: true });

  const items: GitHubContentsItem[] = [];
  for (const dirent of dirents) {
    const isDir = dirent.isDirectory();
    const isFile = dirent.isFile();
    if (!isDir && !isFile) continue;

    const relPath = path ? `${path}/${dirent.name}` : dirent.name;
    const absPath = join(base, relPath);

    let sha = "";
    if (isFile) {
      const info = await stat(absPath);
      sha = localSha(info.mtimeMs, info.size);
    }

    items.push({
      name: dirent.name,
      path: relPath,
      sha,
      type: isDir ? "dir" : "file",
      url: absPath,
      download_url: isFile ? absPath : null,
    });
  }
  return items;
}

export async function fetchContents(
  owner: string,
  repo: string,
  path: string,
): Promise<GitHubContentsItem[]> {
  if (isLocalMode()) {
    return fetchContentsLocal(path);
  }
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} GET ${url}: ${body}`);
  }
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as GitHubContentsItem[]) : [data as GitHubContentsItem];
}

/**
 * Lists every prerelease (Unearthed Arcana) data file on disk. Walks the
 * content-type directories at the prerelease repo root (class/, subclass/,
 * spell/, collection/, …), skipping tooling dirs (those starting with `_` or
 * `.`) and `fluff-*` files. Returns absolute-path `url`s and mtime-keyed shas so
 * the parse cache invalidates on change. Returns [] when prerelease is off.
 */
export async function listPrereleaseFiles(): Promise<
  { name: string; path: string; url: string; sha: string }[]
> {
  const base = localPrereleaseDir();
  if (!base) return [];

  const rootEntries = await readdir(base, { withFileTypes: true });
  const out: { name: string; path: string; url: string; sha: string }[] = [];

  for (const dirent of rootEntries) {
    if (!dirent.isDirectory()) continue;
    if (dirent.name.startsWith("_") || dirent.name.startsWith(".")) continue;

    const dirAbs = join(base, dirent.name);
    const files = await readdir(dirAbs, { withFileTypes: true });
    for (const f of files) {
      if (!f.isFile() || !f.name.endsWith(".json")) continue;
      if (f.name.startsWith("fluff-")) continue;
      const absPath = join(dirAbs, f.name);
      const info = await stat(absPath);
      out.push({
        name: f.name,
        path: `${dirent.name}/${f.name}`,
        url: absPath,
        sha: localSha(info.mtimeMs, info.size),
      });
    }
  }
  return out;
}

/**
 * In-memory cache of parsed local JSON files, keyed by absolute path.
 * The cached mtime guards against stale reads: if the file changes on disk,
 * the entry is re-read and re-parsed. This keeps repeated searches over large
 * files (items.json ~2.7MB, bestiary files) from re-parsing on every call.
 */
const localParseCache = new Map<string, { mtimeMs: number; data: unknown }>();

async function fetchRawLocal(path: string): Promise<unknown> {
  const info = await stat(path);
  const cached = localParseCache.get(path);
  if (cached && cached.mtimeMs === info.mtimeMs) {
    return cached.data;
  }
  const text = await readFile(path, "utf-8");
  const data: unknown = JSON.parse(text);
  localParseCache.set(path, { mtimeMs: info.mtimeMs, data });
  return data;
}

export async function fetchRaw(url: string): Promise<unknown> {
  // Local mode stores absolute filesystem paths in the manifest `url` field.
  if (!/^https?:\/\//i.test(url) && (isLocalMode() || isAbsolute(url))) {
    return fetchRawLocal(url);
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "5eMCP/1.0.0" },
  });
  if (!res.ok) {
    throw new Error(`Fetch ${res.status} GET ${url}`);
  }
  return res.json();
}

export function rawUrl(owner: string, repo: string, branch: string, path: string): string {
  if (isLocalMode()) {
    return join(localDataDir()!, path);
  }
  return `${GITHUB_RAW}/${owner}/${repo}/${branch}/${path}`;
}
