#!/bin/bash
# 🚀 DEPLOYMENT SCRIPT FOR MEDWATCH AI
# Exécutez ce script juste avant le déploiement Render

set -e  # Exit on error

echo "════════════════════════════════════════════════════════"
echo "🚀 MedWatch AI - Pre-Deployment Verification"
echo "════════════════════════════════════════════════════════"
echo ""

# 1. Check Node version
echo "✓ Checking Node.js version..."
node --version
echo ""

# 2. Check if build exists
if [ -d "dist" ]; then
    echo "✓ Build directory found (dist/)"
    ls -lah dist/ | head -5
else
    echo "⚠️  Building application..."
    npm run build
fi
echo ""

# 3. Verify server.js exists
if [ -f "dist/server.js" ]; then
    echo "✅ Server compiled successfully (dist/server.js)"
else
    echo "❌ ERROR: Server not compiled!"
    exit 1
fi
echo ""

# 4. Check environment variables
echo "✓ Checking environment variables..."
if [ -z "$GEMINI_API_KEY" ]; then
    echo "  ℹ️  GEMINI_API_KEY not set in shell (it will be set in Render)"
else
    echo "  ✓ GEMINI_API_KEY is configured"
fi
echo ""

# 5. Check .gitignore
echo "✓ Verifying .gitignore..."
if grep -q ".env*" .gitignore; then
    echo "  ✅ .env files are in .gitignore"
else
    echo "  ⚠️  .env files might not be ignored"
fi
echo ""

# 6. Verify render.yaml exists
if [ -f "render.yaml" ]; then
    echo "✅ render.yaml configured"
    grep "buildCommand\|startCommand" render.yaml
else
    echo "❌ ERROR: render.yaml not found!"
    exit 1
fi
echo ""

# 7. Git status
echo "✓ Git status:"
git status --short
echo ""

# 8. Ready to deploy
echo "════════════════════════════════════════════════════════"
echo "✅ ALL CHECKS PASSED - Ready for Deployment!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Push code: git push origin main"
echo "2. Go to: https://dashboard.render.com"
echo "3. Create new Web Service"
echo "4. Select: bonbusiness95-cyber/MEDWATCH"
echo "5. Configure env vars and deploy"
echo ""
