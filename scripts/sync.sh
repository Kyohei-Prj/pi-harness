#!/bin/sh
# Sync Pi coding-agent config between this repo and the live agent directory.
#
#   scripts/sync.sh pull    ~/.pi/agent  ->  ./agent      (save current config)
#   scripts/sync.sh push    ./agent      ->  ~/.pi/agent  (restore onto a machine)
#
# The agent directory defaults to ~/.pi/agent; override with PI_CODING_AGENT_DIR.
# Secrets (auth.json, mcp-auth.json) and runtime state (sessions, installs, caches)
# are never copied in either direction.
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
agent_dir=${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}
mirror_dir=$repo_dir/agent

# Relative paths that count as configuration. Missing ones are skipped.
config_files="settings.json mcp.json models.json models-store.json keybindings.json SYSTEM.md APPEND_SYSTEM.md"
config_dirs="extensions skills prompts themes"

copy_one() {
	from=$1
	to=$2
	mkdir -p "$(dirname -- "$to")"
	cp -p -- "$from" "$to"
	printf '  %s\n' "$from"
}

do_pull() {
	[ -d "$agent_dir" ] || { echo "no agent directory at $agent_dir" >&2; exit 1; }
	mkdir -p "$mirror_dir"
	for f in $config_files; do
		[ -f "$agent_dir/$f" ] && copy_one "$agent_dir/$f" "$mirror_dir/$f"
	done
	for d in $config_dirs; do
		if [ -d "$agent_dir/$d" ]; then
			rm -rf -- "$mirror_dir/$d"
			cp -Rp -- "$agent_dir/$d" "$mirror_dir/$d"
			printf '  %s/\n' "$agent_dir/$d"
		fi
	done
	echo "pull complete: $agent_dir -> $mirror_dir"
}

do_push() {
	[ -d "$mirror_dir" ] || { echo "no mirror directory at $mirror_dir" >&2; exit 1; }
	mkdir -p "$agent_dir"
	backup_dir=$(mktemp -d "${TMPDIR:-/tmp}/pi-agent-backup.XXXXXX")
	for f in $config_files; do
		[ -f "$mirror_dir/$f" ] || continue
		if [ -f "$agent_dir/$f" ]; then
			cp -p -- "$agent_dir/$f" "$backup_dir/$f"
			printf '  kept previous %s\n' "$agent_dir/$f"
		fi
		copy_one "$mirror_dir/$f" "$agent_dir/$f"
	done
	for d in $config_dirs; do
		if [ -d "$mirror_dir/$d" ]; then
			mkdir -p "$agent_dir/$d"
			cp -Rp -- "$mirror_dir/$d/." "$agent_dir/$d/"
			printf '  %s/\n' "$mirror_dir/$d"
		fi
	done
	echo "push complete: $mirror_dir -> $agent_dir"
	echo "previous files (if any) saved in $backup_dir"
	echo "run /reload inside pi, or restart it, to pick up the changes."
}

case ${1:-} in
	pull) do_pull ;;
	push) do_push ;;
	*)
		echo "usage: $0 pull | push" >&2
		exit 2
		;;
esac
