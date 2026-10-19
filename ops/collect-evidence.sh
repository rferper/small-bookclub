#!/bin/sh
# A shell-free Node command dispatcher owns all Docker query construction.
set -eu
if [ "$#" -ne 1 ]; then
  echo 'Usage: ops/collect-evidence.sh <exact-monitoring-project>' >&2
  exit 1
fi
exec node "$(dirname "$0")/oncall/collect.mjs" "$1"
