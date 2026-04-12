#!/bin/bash
# Pre-deployment checks for MedWatch AI

echo "🔍 Checking MedWatch AI deployment readiness..."
echo ""

# Check Node version
echo "✓ Node version:"
node --version

# Check npm packages
echo ""
echo "✓ Checking npm dependencies..."
if npm list > /dev/null 2>&1; then
    echo "  All dependencies are installed"
else
    echo "  ⚠️  Running npm install..."
    npm install
fi

# Check for required environment variables
echo ""
echo "✓ Checking environment variables..."
if [ -z "$GEMINI_API_KEY" ]; then
    echo "  ⚠️  GEMINI_API_KEY not set. Add it to Render dashboard."
fi

# Check build
echo ""
echo "✓ Running TypeScript check..."
npm run lint

echo ""
echo "✓ Building application..."
npm run build

if [ -d "dist" ]; then
    echo "  ✅ Build successful! Found dist directory"
else
    echo "  ❌ Build failed! dist directory not found"
    exit 1
fi

echo ""
echo "✅ All checks passed! Ready for deployment."
echo ""
echo "Next steps:"
echo "1. Push to GitHub: git push origin main"
echo "2. Deploy on Render dashboard"
echo "3. Check logs: https://dashboard.render.com"
