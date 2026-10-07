#!/usr/bin/env bash
#
# Sanitized publication to a mirror remote (GitHub).
#
# Gitea is the source of truth: branches, tags, issues, PRs and the full history,
# including build sources and internal tooling. A mirror is a *product* channel, so
# the published tree carries only product files — never agent instructions, plans,
# build sources, caches or infrastructure documents.
#
# Usage:
#   ./scripts/publish-github.sh --check [<gitea-ref>]               # read-only: what would go
#   ./scripts/publish-github.sh --push <gitea-ref> [--tag <tag>]   # publish a sanitized tree and tag
#
# The allowlist is the package's own `files` field (i.e. exactly what npm ships)
# plus the repository files a reader needs: .gitignore, LICENSE, README*.md,
# CHANGELOG.md, package.json, cordis.patch.yml.
#
# What --push does:
#   1. builds that tree from <gitea-ref>;
#   2. refuses to publish when a forbidden path or a required product file is missing;
#   3. creates ONE commit on top of the mirror branch carrying the tree and pushes it
#      as a normal fast-forward — never a force;
#   4. if --tag <tag> is given, points the mirror tag to the sanitized commit and updates
#      the GitHub Release (Latest);
#   5. prints the Gitea SHA -> mirror SHA correspondence for the release notes.
#
# Rewriting mirror history is a destructive operation on a published channel and is
# deliberately not implemented. Removing a file from *past* mirror history requires
# recreating the mirror repository and an explicit owner decision.
#
# Environment: MIRROR_REMOTE (default github), MIRROR_BRANCH (default main).
set -euo pipefail

MIRROR_REMOTE="${MIRROR_REMOTE:-github}"
MIRROR_BRANCH="${MIRROR_BRANCH:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Repository files a reader needs, on top of the package's npm contents.
EXTRA_ALLOW=(
  ".gitignore"
  "LICENSE"
  "README.md"
  "README.ru.md"
  "README.zh.md"
  "CHANGELOG.md"
  "package.json"
  "cordis.patch.yml"
)

# Never publish these, even if they sneak into the allowlist.
FORBIDDEN=(
  "AGENTS.md"
  "index.md"
  "deploy.sh"
  ".gitea"
  ".worktrees"
  ".planning"
  "__pycache__"
  ".ruff_cache"
  ".venv"
  "node_modules"
)

mode=""
gitea_ref=""
target_tag=""

while [ $# -gt 0 ]; do
  case "$1" in
    --check)
      mode="check"
      shift
      ;;
    --push)
      mode="push"
      gitea_ref="${2:-}"
      if [ -z "$gitea_ref" ] || [ "${gitea_ref:0:1}" = "-" ]; then
        echo "error: --push requires a gitea ref" >&2
        exit 2
      fi
      shift 2
      ;;
    --tag)
      target_tag="${2:-}"
      if [ -z "$target_tag" ]; then
        echo "error: --tag requires a tag name" >&2
        exit 2
      fi
      shift 2
      ;;
    -*)
      echo "unknown option: $1" >&2
      exit 2
      ;;
    *)
      if [ -z "$gitea_ref" ]; then
        gitea_ref="$1"
        shift
      else
        echo "unexpected argument: $1" >&2
        exit 2
      fi
      ;;
  esac
done

if [ -z "$mode" ]; then
  echo "usage: ./scripts/publish-github.sh --check [<gitea-ref>] | --push <gitea-ref> [--tag <tag>]" >&2
  exit 2
fi
if [ "$mode" = "push" ] && [ -z "$gitea_ref" ]; then
  echo "usage: ./scripts/publish-github.sh --push <gitea-ref> [--tag <tag>]" >&2
  exit 2
fi

cd "$REPO_DIR"

# The allowlist comes from the package manifest of the ref being published.
ALLOW=("${EXTRA_ALLOW[@]}")
while IFS= read -r entry; do
  [ -n "$entry" ] && ALLOW+=("${entry%/}" )
done < <(git show "${gitea_ref:-origin/main}:package.json" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{const p=JSON.parse(s);for(const f of (p.files||[])) console.log(f.replace(/\/\*\*$/,""));}catch(e){}
  });')

is_allowed() {
  local path="$1" entry
  for entry in "${ALLOW[@]}"; do
    if [ "$path" = "$entry" ]; then return 0; fi
    case "$path" in "$entry"/*) return 0 ;; esac
  done
  return 1
}

is_forbidden() {
  local path="$1" entry
  for entry in "${FORBIDDEN[@]}"; do
    if [ "$path" = "$entry" ]; then return 0; fi
    case "$path" in "$entry"/*) return 0 ;; esac
  done
  return 1
}

list_tree() {
  local ref="$1" path
  git ls-tree -r --name-only "$ref" | while IFS= read -r path; do
    if is_forbidden "$path"; then continue; fi
    if is_allowed "$path"; then echo "$path"; fi
  done | LC_ALL=C sort
}

echo "repository : $REPO_DIR"
echo "mirror     : $MIRROR_REMOTE/$MIRROR_BRANCH"
echo

if [ "$mode" = "check" ]; then
  ref="${gitea_ref:-origin/main}"
  echo "WILL BE PUBLISHED (sanitized tree of $ref):"
  list_tree "$ref" | sed 's/^/  /'
  echo
  echo "WILL BE DROPPED (not product):"
  git ls-tree -r --name-only "$ref" | while IFS= read -r path; do
    if is_allowed "$path" && ! is_forbidden "$path"; then continue; fi
    echo "  $path"
  done
  exit 0
fi

source_sha="$(git rev-parse "$gitea_ref")"
mirror_sha="$(git rev-parse "$MIRROR_REMOTE/$MIRROR_BRANCH")"
echo "gitea ref  : $gitea_ref = $source_sha"
echo "mirror head: $MIRROR_REMOTE/$MIRROR_BRANCH = $mirror_sha"
echo

sanitized_list="$(mktemp)"
tmp_index="$(mktemp)"
trap 'rm -f "$sanitized_list" "$tmp_index"' EXIT
list_tree "$gitea_ref" > "$sanitized_list"

if list_tree "$gitea_ref" | while IFS= read -r path; do
     if is_forbidden "$path"; then echo "FORBIDDEN $path"; fi
   done | grep -q FORBIDDEN; then
  echo "refusing to publish: the sanitized list contains a forbidden path" >&2
  exit 3
fi

for required in package.json README.md; do
  if ! grep -qx "$required" "$sanitized_list"; then
    echo "refusing to publish: required product file missing: $required" >&2
    exit 4
  fi
done

echo "files to publish: $(wc -l < "$sanitized_list")"
sed 's/^/  /' "$sanitized_list"
echo

# A temporary index is used instead of `git mktree`: mktree accepts only single-level
# entries and refuses nested paths such as lib/client.js, while `update-index
# --cacheinfo` builds the intermediate trees for us.
GIT_INDEX_FILE="$tmp_index" git read-tree --empty
while IFS= read -r path; do
  blob="$(git rev-parse "$gitea_ref:$path")"
  GIT_INDEX_FILE="$tmp_index" git update-index --add --cacheinfo "100644,$blob,$path"
done < "$sanitized_list"
new_tree="$(GIT_INDEX_FILE="$tmp_index" git write-tree)"

new_commit="$(git commit-tree "$new_tree" -p "$mirror_sha" -m "chore(publish): sanitized tree from ${source_sha:0:8}")"
echo "new mirror commit: $new_commit"

git push "$MIRROR_REMOTE" "$new_commit:refs/heads/$MIRROR_BRANCH"

if [ -n "$target_tag" ]; then
  echo "verifying tag immutability for $target_tag on $MIRROR_REMOTE..."
  existing_tag_sha="$(git ls-remote --tags "$MIRROR_REMOTE" "refs/tags/$target_tag" 2>/dev/null | awk '{print $1}' || true)"
  if [ -n "$existing_tag_sha" ]; then
    peeled_sha="$(git ls-remote --tags "$MIRROR_REMOTE" "refs/tags/$target_tag^{}" 2>/dev/null | awk '{print $1}' || true)"
    effective_remote_sha="${peeled_sha:-$existing_tag_sha}"
    if [ "$effective_remote_sha" = "$new_commit" ] || [ "$existing_tag_sha" = "$new_commit" ]; then
      echo "tag $target_tag already exists on $MIRROR_REMOTE pointing to $new_commit (immutable no-op)"
    else
      echo "error: refusing to overwrite existing tag $target_tag on $MIRROR_REMOTE (remote SHA: $effective_remote_sha, target SHA: $new_commit)" >&2
      exit 5
    fi
  else
    echo "pushing sanitized tag $target_tag to $MIRROR_REMOTE..."
    git push "$MIRROR_REMOTE" "$new_commit:refs/tags/$target_tag"
  fi

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    echo "creating/updating GitHub release for $target_tag..."
    notes=""
    clean_ver="${target_tag#v}"
    if [ -f "$REPO_DIR/CHANGELOG.md" ]; then
      notes="$(node -e '
        const fs = require("fs");
        const ver = process.argv[1];
        const content = fs.readFileSync("CHANGELOG.md", "utf8");
        const re = new RegExp("## \\[" + ver + "\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)");
        const m = content.match(re);
        if (m) process.stdout.write(m[1].trim());
      ' "$clean_ver" 2>/dev/null || true)"
    fi
    [ -z "$notes" ] && notes="Release $target_tag"

    if gh release view "$target_tag" --repo GooDAnDReaDY/dsh-gitea >/dev/null 2>&1; then
      gh release edit "$target_tag" --repo GooDAnDReaDY/dsh-gitea --target "$new_commit" --latest --notes "$notes"
    else
      gh release create "$target_tag" --repo GooDAnDReaDY/dsh-gitea --target "$new_commit" --title "$target_tag" --notes "$notes" --latest
    fi
  fi
fi

echo
echo "correspondence to record in the release notes:"
echo "  gitea  $source_sha"
echo "  mirror $new_commit"
