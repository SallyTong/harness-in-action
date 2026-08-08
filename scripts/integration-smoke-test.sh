#!/usr/bin/env bash
#
# Integration Smoke Test — AI Homework Grader
#
# WHY THIS EXISTS:
# Unit tests mock system boundaries (DB, GLM-4V API). Those tests pass even when
# the real integration is broken. This script tests actual running services talking
# to each other. Run it after every implementation phase.
#
# ADAPTED AUTH MODEL:
# MVP has no registration/login/sessions. Phone number serves as lightweight
# parent identity. Every request (except /health) carries ?phone= or X-Parent-Phone
# header. First use with a new phone auto-creates the Parent record.
#
# EXTENDING:
# Add checks per phase. Each check() call tests one integration point.
# Phase 2: add POST /api/submissions (upload + poll until completed)
# Phase 3: add GET /api/submissions list + PATCH .../questions/{qid}
# Phase 4: add GET /api/error-collections + POST .../generate
# Phase 5: add cross-device consistency checks
#
# Usage:
#   bash scripts/integration-smoke-test.sh
# Prerequisites:
#   Backend running (Docker or dev mode) on BACKEND_URL
#   Frontend running on FRONTEND_URL

set -euo pipefail

# --- Configuration ---
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
SMOKE_PHONE="13800000001"
SMOKE_PHONE_B="13800000002"   # Second phone for data-isolation checks
TIMESTAMP=$(date +%s)

# --- Counters ---
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TOTAL_COUNT=0

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# --- Cleanup tracking ---
CREATED_CHILD_ID=""

cleanup() {
    if [ -n "$CREATED_CHILD_ID" ]; then
        curl -s -X DELETE "$BACKEND_URL/api/children/$CREATED_CHILD_ID?phone=$SMOKE_PHONE" > /dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

# --- Helper Functions ---

check() {
    # Usage: check "Test Name" "actual_value" "expected_value"
    local name="$1"
    local actual="$2"
    local expected="$3"
    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}PASS${NC}  $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "  ${RED}FAIL${NC}  $name (expected: $expected, got: $actual)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

check_contains() {
    # Usage: check_contains "Test Name" "haystack" "needle"
    local name="$1"
    local haystack="$2"
    local needle="$3"
    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    if echo "$haystack" | grep -q "$needle"; then
        echo -e "  ${GREEN}PASS${NC}  $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "  ${RED}FAIL${NC}  $name (expected body to contain: $needle)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

check_json_field() {
    # Usage: check_json_field "Test Name" "json_body" "field" "expected_value"
    local name="$1"
    local body="$2"
    local field="$3"
    local expected="$4"
    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    local actual
    actual=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field',''))" 2>/dev/null || echo "")
    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}PASS${NC}  $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "  ${RED}FAIL${NC}  $name ($field: expected=$expected, got=$actual)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo ""
echo "========================================"
echo "  AI Homework Grader — Smoke Test"
echo "========================================"
echo "  Backend  → $BACKEND_URL"
echo "  Frontend → $FRONTEND_URL"
echo "  Phone    → $SMOKE_PHONE"
echo "========================================"
echo ""

# ═══════════════════════════════════════════════════════
# 1. Service Health
# ═══════════════════════════════════════════════════════

echo "--- 1. Service Health ---"

# Backend health check
BACKEND_HEALTH=$(curl -s -w '\n%{http_code}' "$BACKEND_URL/api/health" 2>/dev/null || echo -e "\n000")
BACKEND_HEALTH_STATUS=$(echo "$BACKEND_HEALTH" | tail -1)
BACKEND_HEALTH_BODY=$(echo "$BACKEND_HEALTH" | head -n -1)
check "Backend /health returns 200" "$BACKEND_HEALTH_STATUS" "200"
check_contains "Backend /health body has status=ok" "$BACKEND_HEALTH_BODY" '"ok"'
check_json_field "Backend /health service name" "$BACKEND_HEALTH_BODY" "service" "ai-homework-grader"

# Frontend page loads (SPA returns 200 for index.html)
FRONTEND_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$FRONTEND_URL" 2>/dev/null || echo "000")
check "Frontend serves index.html" "$FRONTEND_STATUS" "200"

# ═══════════════════════════════════════════════════════
# 2. Phone Identity Setup
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 2. Phone Identity ---"

# MVP auth model: no registration or login. First request with a phone
# number to any endpoint auto-creates the Parent record. Subsequent
# requests with the same phone see the same parent-scoped data.
#
# We verify this by: listing children for a fresh phone (should return
# default children or empty), then checking that a different phone sees
# different data (data isolation).

# Initial state: list children for SMOKE_PHONE
INITIAL_LIST=$(curl -s -w '\n%{http_code}' \
    "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" 2>/dev/null || echo -e "\n000")
INITIAL_LIST_STATUS=$(echo "$INITIAL_LIST" | tail -1)
INITIAL_LIST_BODY=$(echo "$INITIAL_LIST" | head -n -1)

if [ "$INITIAL_LIST_STATUS" = "200" ]; then
    check "Phone identity: list children returns 200" "$INITIAL_LIST_STATUS" "200"
    # New parent should have default children "小朋友1", "小朋友2" or empty list
    echo "         (children count: $(echo "$INITIAL_LIST_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)" 2>/dev/null || echo "?"))"
else
    check "Phone identity: list children returns 200" "$INITIAL_LIST_STATUS" "200"
fi

# Verify second phone has isolated data space
PHONE_B_LIST=$(curl -s -w '\n%{http_code}' \
    "$BACKEND_URL/api/children?phone=$SMOKE_PHONE_B" 2>/dev/null || echo -e "\n000")
PHONE_B_LIST_STATUS=$(echo "$PHONE_B_LIST" | tail -1)
check "Phone data isolation: second phone also gets 200" "$PHONE_B_LIST_STATUS" "200"

# ═══════════════════════════════════════════════════════
# 3. Core CRUD — Child Entity
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 3. Child CRUD ---"

# 3a. CREATE a child
CREATE_RESPONSE=$(curl -s -w '\n%{http_code}' \
    -X POST "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"smoke-test-$TIMESTAMP\"}" \
    2>/dev/null || echo -e "\n000")
CREATE_STATUS=$(echo "$CREATE_RESPONSE" | tail -1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | head -n -1)
check "POST /api/children (create)" "$CREATE_STATUS" "201"

# Extract child ID for subsequent operations
CREATED_CHILD_ID=$(echo "$CREATE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ -n "$CREATED_CHILD_ID" ] && [ "$CREATED_CHILD_ID" != "" ]; then
    echo "         created child_id=$CREATED_CHILD_ID"

    # 3b. READ — list should include the created child
    LIST_RESPONSE=$(curl -s -w '\n%{http_code}' \
        "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" 2>/dev/null || echo -e "\n000")
    LIST_STATUS=$(echo "$LIST_RESPONSE" | tail -1)
    LIST_BODY=$(echo "$LIST_RESPONSE" | head -n -1)
    check "GET /api/children (list after create)" "$LIST_STATUS" "200"
    check_contains "List contains created child" "$LIST_BODY" "smoke-test-$TIMESTAMP"

    # 3c. UPDATE — rename the child
    UPDATE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        -X PUT "$BACKEND_URL/api/children/$CREATED_CHILD_ID?phone=$SMOKE_PHONE" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"smoke-renamed-$TIMESTAMP\"}" \
        2>/dev/null || echo "000")
    check "PUT /api/children/{id} (rename)" "$UPDATE_STATUS" "200"

    # Verify rename persisted
    RENAMED_RESPONSE=$(curl -s \
        "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" 2>/dev/null || echo "")
    check_contains "Rename persisted in list" "$RENAMED_RESPONSE" "smoke-renamed-$TIMESTAMP"

    # 3d. DATA ISOLATION — second phone cannot access first phone's child
    # (No GET /api/children/{id} endpoint — verify isolation via PUT/DELETE)
    ISOLATION_UPDATE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        -X PUT "$BACKEND_URL/api/children/$CREATED_CHILD_ID?phone=$SMOKE_PHONE_B" \
        -H "Content-Type: application/json" \
        -d '{"name": "hacked"}' 2>/dev/null || echo "000")
    check "Isolation: phone B cannot rename phone A's child (404)" "$ISOLATION_UPDATE_STATUS" "404"

    # 3e. DELETE — remove the child
    DELETE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        -X DELETE "$BACKEND_URL/api/children/$CREATED_CHILD_ID?phone=$SMOKE_PHONE" \
        2>/dev/null || echo "000")
    check "DELETE /api/children/{id}" "$DELETE_STATUS" "204"
    CREATED_CHILD_ID=""  # prevent cleanup trap from double-deleting

    # Verify deletion
    DELETED_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        "$BACKEND_URL/api/children/$CREATED_CHILD_ID?phone=$SMOKE_PHONE" 2>/dev/null || echo "")
    # The ID is gone so we can't re-read it. Check it's no longer in the list.
    FINAL_LIST=$(curl -s "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" 2>/dev/null || echo "")
    if ! echo "$FINAL_LIST" | grep -q "smoke-renamed-$TIMESTAMP"; then
        check "Deleted child absent from list" "absent" "absent"
    else
        check "Deleted child absent from list" "present" "absent"
    fi
else
    echo -e "  ${YELLOW}SKIP${NC}  Subsequent CRUD checks (child creation failed — skipping)"
    SKIP_COUNT=$((SKIP_COUNT + 5))  # read, update, isolation×2, delete
fi

# ═══════════════════════════════════════════════════════
# 4. Input Validation
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 4. Input Validation ---"

# Missing required fields
MISSING_NAME_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || echo "000")
check "POST child without name → 422" "$MISSING_NAME_STATUS" "422"

# Invalid phone format (non-11-digit)
BAD_PHONE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    "$BACKEND_URL/api/children?phone=123" 2>/dev/null || echo "000")
check "Invalid phone format → 422" "$BAD_PHONE_STATUS" "422"

# Missing phone entirely
MISSING_PHONE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    "$BACKEND_URL/api/children" 2>/dev/null || echo "000")
check "Missing phone param → 422" "$MISSING_PHONE_STATUS" "422"

# Empty name
EMPTY_NAME_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" \
    -H "Content-Type: application/json" \
    -d '{"name": ""}' 2>/dev/null || echo "000")
check "POST child with empty name → 422" "$EMPTY_NAME_STATUS" "422"

# Name too long (>50 chars)
LONG_NAME=$(python3 -c "print('A'*51)" 2>/dev/null || echo "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
LONG_NAME_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$LONG_NAME\"}" 2>/dev/null || echo "000")
check "POST child with name >50 chars → 422" "$LONG_NAME_STATUS" "422"

# ═══════════════════════════════════════════════════════
# 5. Frontend Pages
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 5. Frontend Pages ---"

declare -a PAGES=(
    "/,首页 (批改上传)"
    "/children,小朋友管理"
    "/history,批改历史"
    "/errors,错题集"
    "/errors/generate,错题试卷生成"
)

for page_entry in "${PAGES[@]}"; do
    IFS=',' read -r page_path page_name <<< "$page_entry"
    PAGE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$FRONTEND_URL$page_path" 2>/dev/null || echo "000")
    check "Page: $page_name ($page_path)" "$PAGE_STATUS" "200"
done

# ═══════════════════════════════════════════════════════
# 6. API via Frontend Proxy (Vite dev or Nginx)
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 6. Frontend API Proxy ---"

# In dev mode, Vite proxies /api/* → backend :8000
# In Docker, Nginx proxies /api/* → backend :8000
PROXY_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    "$FRONTEND_URL/api/health" 2>/dev/null || echo "000")
check "Frontend proxies /api/health to backend" "$PROXY_STATUS" "200"

# Verify proxy returns correct content
PROXY_BODY=$(curl -s "$FRONTEND_URL/api/health" 2>/dev/null || echo "")
check_contains "Proxy response contains service name" "$PROXY_BODY" "ai-homework-grader"

# ═══════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════

echo ""
echo "========================================"
echo "  Results"
echo "========================================"
echo "  Passed:  $PASS_COUNT"
echo "  Failed:  $FAIL_COUNT"
if [ "$SKIP_COUNT" -gt 0 ]; then
    echo "  Skipped: $SKIP_COUNT"
fi
echo "  Total:   $TOTAL_COUNT"
echo "========================================"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "${RED}SMOKE TEST FAILED${NC} — fix failures before proceeding."
    exit 1
else
    echo -e "${GREEN}ALL CHECKS PASSED${NC}"
    exit 0
fi
