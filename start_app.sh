#!/bin/bash

# Path to the project root
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Kill any existing processes on these ports (optional but helpful for restarts)
fuser -k 9457/tcp 2>/dev/null
fuser -k 9458/tcp 2>/dev/null

echo "Starting Backend on port 9458..."
cd "$PROJECT_ROOT/server"
npm run start &

echo "Starting Frontend on port 9457..."
cd "$PROJECT_ROOT/client"
npm run dev:remote &
#npm run dev &

# Wait for background processes
wait
