@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo 🚀 EVID-DGC GitHub PR Creation Script
echo ========================================
echo.

REM Check if GitHub CLI is installed
gh --version >nul 2>&1
if errorlevel 1 (
    echo ❌ GitHub CLI (gh) is not installed. Please install it first.
    echo Visit: https://cli.github.com/
    pause
    exit /b 1
)

REM Check if user is authenticated
gh auth status >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Please authenticate with GitHub CLI first:
    echo gh auth login
    pause
    exit /b 1
)

echo ✅ GitHub CLI is ready
echo.

echo Creating pull requests for all feature branches...
echo.

REM Create PR for Security Branch
echo 🔒 Creating PR for Hybrid RBAC/ABAC Security System...
gh pr create --base main --head feature/hybrid-rbac-abac-security --title "🔒 Hybrid RBAC/ABAC Security System" --body-file ".github/pull_request_template/security.md" --draft
if errorlevel 1 (
    echo ❌ Failed to create security PR
) else (
    echo ✅ Security PR created successfully
)
echo.

REM Create PR for Blockchain Branch
echo ⛓️ Creating PR for C2PA Provenance & Blockchain Integrity...
gh pr create --base main --head feature/c2pa-provenance-blockchain --title "⛓️ C2PA Provenance & Blockchain Integrity" --body-file ".github/pull_request_template/blockchain.md" --draft
if errorlevel 1 (
    echo ❌ Failed to create blockchain PR
) else (
    echo ✅ Blockchain PR created successfully
)
echo.

REM Create PR for Analytics Branch
echo 📊 Creating PR for Advanced Analytics & Audit System...
gh pr create --base main --head feature/advanced-analytics-audit --title "📊 Advanced Analytics & Audit System" --body-file ".github/pull_request_template/analytics.md" --draft
if errorlevel 1 (
    echo ❌ Failed to create analytics PR
) else (
    echo ✅ Analytics PR created successfully
)
echo.

REM Create PR for Performance Branch
echo ⚡ Creating PR for Performance Optimization System...
gh pr create --base main --head feature/performance-optimization --title "⚡ Performance Optimization System" --body-file ".github/pull_request_template/performance.md" --draft
if errorlevel 1 (
    echo ❌ Failed to create performance PR
) else (
    echo ✅ Performance PR created successfully
)
echo.

REM Create PR for Testing Branch
echo 🧪 Creating PR for Comprehensive Testing Suite...
gh pr create --base main --head feature/comprehensive-testing-suite --title "🧪 Comprehensive Testing Suite" --body-file ".github/pull_request_template/testing.md" --draft
if errorlevel 1 (
    echo ❌ Failed to create testing PR
) else (
    echo ✅ Testing PR created successfully
)
echo.

REM Create PR for Legal Branch
echo 🌍 Creating PR for Regional Legal Templates & Multi-Jurisdiction...
gh pr create --base main --head feature/regional-legal-templates --title "🌍 Regional Legal Templates & Multi-Jurisdiction" --body-file ".github/pull_request_template/legal.md" --draft
if errorlevel 1 (
    echo ❌ Failed to create legal PR
) else (
    echo ✅ Legal PR created successfully
)
echo.

echo ========================================
echo 🎉 All pull requests have been created!
echo ========================================
echo.
echo 📋 Summary:
echo - 6 feature branches pushed to GitHub
echo - 6 pull requests created with detailed templates
echo - All PRs are in draft mode for review
echo.
echo Next steps:
echo 1. Review each PR individually
echo 2. Mark PRs as ready for review when complete
echo 3. Merge in recommended order:
echo    security → blockchain → analytics → performance → testing → legal
echo.
echo 🔗 GitHub Repository: https://github.com/Gooichand/blockchain-evidence
echo 🔗 Pull Requests: https://github.com/Gooichand/blockchain-evidence/pulls
echo.
pause