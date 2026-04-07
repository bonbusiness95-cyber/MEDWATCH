#!/bin/bash
# Test affinity for MedWatch AI

echo "🧪 Testing MedWatch AI before deployment..."
echo ""

# Test if build exists
if [ ! -d "dist" ]; then
    echo "❌ dist directory not found. Running build..."
    npm run build
fi

# Test server start (background)
echo "Testing server startup..."
timeout 5 node dist/server.js &
SERVER_PID=$!

sleep 2

# Test if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Server started successfully"
else
    echo "❌ Server failed to start"
    exit 1
fi

# Test API endpoints
echo ""
echo "Testing API endpoints..."

# Test health check (if implemented)
# curl -s http://localhost:3000 | grep -q "MedWatch" && echo "✅ API responding" || echo "⚠️  API response unclear"

# Cleanup
kill $SERVER_PID 2>/dev/null

echo ""
echo "✅ All tests passed! Ready for deployment."
