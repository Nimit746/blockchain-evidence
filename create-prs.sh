#!/bin/bash

# GitHub PR Creation Script for EVID-DGC Advanced Features
# This script creates pull requests for all feature branches

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 EVID-DGC GitHub PR Creation Script${NC}"
echo "======================================"

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed. Please install it first.${NC}"
    echo "Visit: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Please authenticate with GitHub CLI first:${NC}"
    echo "gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI is ready${NC}"
echo ""

# Array of branches and their details
declare -A branches=(
    ["feature/hybrid-rbac-abac-security"]="🔒 Hybrid RBAC/ABAC Security System|security.md|Implement advanced security with hybrid RBAC/ABAC, rate limiting, and threat detection"
    ["feature/c2pa-provenance-blockchain"]="⛓️ C2PA Provenance & Blockchain Integrity|blockchain.md|Implement C2PA provenance metadata and blockchain integrity system"
    ["feature/advanced-analytics-audit"]="📊 Advanced Analytics & Audit System|analytics.md|Implement NIST-aligned analytics and forensic readiness dashboard"
    ["feature/performance-optimization"]="⚡ Performance Optimization System|performance.md|Implement storage tiering and progressive preview system"
    ["feature/comprehensive-testing-suite"]="🧪 Comprehensive Testing Suite|testing.md|Implement forensic scenario and load testing infrastructure"
    ["feature/regional-legal-templates"]="🌍 Regional Legal Templates & Multi-Jurisdiction|legal.md|Implement legal templates and multi-jurisdiction compliance"
)

# Function to create PR
create_pr() {
    local branch=$1
    local title=$2
    local template=$3
    local description=$4
    
    echo -e "${BLUE}Creating PR for: ${branch}${NC}"
    
    # Create the PR using GitHub CLI
    if gh pr create \
        --base main \
        --head "$branch" \
        --title "$title" \
        --body-file ".github/pull_request_template/$template" \
        --draft; then
        echo -e "${GREEN}✅ PR created successfully for $branch${NC}"
        echo ""
    else
        echo -e "${RED}❌ Failed to create PR for $branch${NC}"
        echo ""
    fi
}

# Create PRs for all branches
echo -e "${YELLOW}Creating pull requests for all feature branches...${NC}"
echo ""

for branch in "${!branches[@]}"; do
    IFS='|' read -r title template description <<< "${branches[$branch]}"
    create_pr "$branch" "$title" "$template" "$description"
    sleep 2  # Small delay between PR creations
done

echo -e "${GREEN}🎉 All pull requests have been created!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "- 6 feature branches pushed to GitHub"
echo "- 6 pull requests created with detailed templates"
echo "- All PRs are in draft mode for review"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review each PR individually"
echo "2. Mark PRs as ready for review when complete"
echo "3. Merge in recommended order (security → blockchain → analytics → performance → testing → legal)"
echo ""
echo -e "${BLUE}GitHub Repository:${NC} https://github.com/Gooichand/blockchain-evidence"
echo -e "${BLUE}Pull Requests:${NC} https://github.com/Gooichand/blockchain-evidence/pulls"