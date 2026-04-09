#!/bin/sh
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
cd /Users/pavelnovak/flow-tasks/.claude/worktrees/eager-burnell/frontend
exec node node_modules/.bin/vite --port 5174
