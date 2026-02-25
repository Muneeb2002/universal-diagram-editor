#!/bin/bash
# Deployment script for GLSP server on EC2
# Usage: ./deploy-server.sh <DEPLOY_PATH>

set -e

DEPLOY_PATH="$1"
if [ -z "$DEPLOY_PATH" ]; then
  echo "Error: DEPLOY_PATH argument is required"
  exit 1
fi

cd "$DEPLOY_PATH"
tar -xzf universal-editor-bundled.tar.gz
rm universal-editor-bundled.tar.gz
cd universal-editor-bundled

if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
  if command -v yarn &> /dev/null; then
    yarn install || npm install
  else
    npm install
  fi
fi

# Stop existing server if running
if command -v pm2 &> /dev/null; then
  pm2 stop glsp-server || true
  pm2 delete glsp-server || true
else
  pkill -f "wf-glsp-server-node.js.*-w" || true
  sleep 2
fi

# Start the server
if command -v yarn &> /dev/null; then
  nohup yarn run start:websocket > server.log 2>&1 &
else
  nohup node --enable-source-maps ./wf-glsp-server-node.js -w --port 8081 > server.log 2>&1 &
fi

echo "Server deployment completed. PID: $!"
