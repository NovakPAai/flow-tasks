#!/bin/sh
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
cd /Users/pavelnovak/flow-tasks/frontend
exec node node_modules/.bin/vite --port 5174
