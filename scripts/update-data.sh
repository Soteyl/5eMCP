#!/usr/bin/env bash
#
# Updates the local 5etools data the MCP server reads in local mode.
#
# - Always git-pulls the Unearthed Arcana / prerelease clone ($LOCAL_PRERELEASE_DIR).
# - Also git-pulls the main 2024 data dir ($LOCAL_DATA_DIR) and the 2014 data dir
#   ($LOCAL_DATA_DIR_2014) if they happen to be git clones.
#
# After a pull, restart the MCP server (reload your Claude Code session) so newly
# *added* files are indexed. Changed file *contents* are picked up automatically
# on the next manifest rebuild (hourly) via the mtime-keyed parse cache.
#
# Usage:
#   LOCAL_PRERELEASE_DIR=/path/to/unearthed-arcana ./scripts/update-data.sh
# or rely on the values already exported in your environment / MCP config.

set -euo pipefail

pull_repo() {
  local label="$1" dir="$2"
  if [[ -z "${dir}" ]]; then
    echo "• ${label}: not configured — skipping."
    return 0
  fi
  if [[ ! -d "${dir}/.git" ]]; then
    echo "• ${label}: '${dir}' is not a git clone — skipping (static dump; re-download to update)."
    return 0
  fi
  echo "• ${label}: pulling '${dir}' …"
  git -C "${dir}" pull --ff-only
}

pull_repo "Prerelease (Unearthed Arcana)" "${LOCAL_PRERELEASE_DIR:-}"
pull_repo "Main data (2024)" "${LOCAL_DATA_DIR:-}"
pull_repo "Main data (2014)" "${LOCAL_DATA_DIR_2014:-}"

echo
echo "Done. Restart the MCP server (reload your Claude Code session) to index any new files."
