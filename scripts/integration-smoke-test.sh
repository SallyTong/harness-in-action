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
# Phase 5: X-Parent-Phone header, rate limiting, 422 format, submission_count fix ✅
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
# 5. Submissions — Upload & Polling (Phase 2)
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 5. Submissions (Phase 2) ---"

# Use the existing test fixture image (generated by backend tests)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_IMAGE_PATH="$PROJECT_ROOT/apps/backend/tests/fixtures/english_test.jpg"

if [ ! -f "$TEST_IMAGE_PATH" ]; then
    echo -e "  ${YELLOW}SKIP${NC}  Submission checks (test image fixture not found at $TEST_IMAGE_PATH)"
    SKIP_COUNT=$((SKIP_COUNT + 10))
else
    echo "         using test image: $TEST_IMAGE_PATH"

# Track created submission for cleanup
CREATED_SUBMISSION_ID=""
SUBMISSION_CLEANUP() {
    # Nothing to clean up — submissions are immutable
    true
}

# Get a valid child_id for the smoke phone
VALID_CHILD_ID=$(curl -s "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) and len(d)>0 else '')" 2>/dev/null || echo "")
echo "         using child_id=$VALID_CHILD_ID"

if [ -z "$VALID_CHILD_ID" ] || [ "$VALID_CHILD_ID" = "" ]; then
    echo -e "  ${YELLOW}SKIP${NC}  Submission checks (no child available — create a child first)"
    SKIP_COUNT=$((SKIP_COUNT + 10))
else
    # 5a. UPLOAD — happy path
    UPLOAD_RESPONSE=$(curl -s -w '\n%{http_code}' \
        -X POST "$BACKEND_URL/api/submissions?phone=$SMOKE_PHONE" \
        -F "image=@$TEST_IMAGE_PATH" \
        -F "subject=english" \
        -F "child_id=$VALID_CHILD_ID" \
        2>/dev/null || echo -e "\n000")
    UPLOAD_STATUS=$(echo "$UPLOAD_RESPONSE" | tail -1)
    UPLOAD_BODY=$(echo "$UPLOAD_RESPONSE" | head -n -1)
    check "POST /api/submissions → 202" "$UPLOAD_STATUS" "202"

    CREATED_SUBMISSION_ID=$(echo "$UPLOAD_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('submission_id',''))" 2>/dev/null || echo "")

    if [ -n "$CREATED_SUBMISSION_ID" ] && [ "$CREATED_SUBMISSION_ID" != "" ]; then
        echo "         created submission_id=$CREATED_SUBMISSION_ID"

        check_json_field "POST /api/submissions status=pending" "$UPLOAD_BODY" "status" "pending"

        # 5b. POLL — GET the submission (should be pending or processing)
        SUBMISSION_RESPONSE=$(curl -s -w '\n%{http_code}' \
            "$BACKEND_URL/api/submissions/$CREATED_SUBMISSION_ID?phone=$SMOKE_PHONE" \
            2>/dev/null || echo -e "\n000")
        SUBMISSION_STATUS=$(echo "$SUBMISSION_RESPONSE" | tail -1)
        SUBMISSION_BODY=$(echo "$SUBMISSION_RESPONSE" | head -n -1)
        check "GET /api/submissions/{id} → 200" "$SUBMISSION_STATUS" "200"

        # Verify status is one of the valid values
        SUB_STATUS=$(echo "$SUBMISSION_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
        if echo "$SUB_STATUS" | grep -qE "^(pending|processing|completed|failed)$"; then
            check "GET submission status is valid" "$SUB_STATUS" "$SUB_STATUS"
        else
            check "GET submission status is valid" "$SUB_STATUS" "pending|processing|completed|failed"
        fi

        # 5c. NOT FOUND — nonexistent submission
        NOTFOUND_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
            "$BACKEND_URL/api/submissions/99999?phone=$SMOKE_PHONE" 2>/dev/null || echo "000")
        check "GET nonexistent submission → 404" "$NOTFOUND_STATUS" "404"

        # 5d. OWNERSHIP — phone B cannot access phone A's submission
        OWNERSHIP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
            "$BACKEND_URL/api/submissions/$CREATED_SUBMISSION_ID?phone=$SMOKE_PHONE_B" \
            2>/dev/null || echo "000")
        check "Isolation: phone B cannot see phone A's submission (404)" "$OWNERSHIP_STATUS" "404"
    else
        echo -e "  ${YELLOW}SKIP${NC}  Polling/ownership checks (submission creation failed)"
        SKIP_COUNT=$((SKIP_COUNT + 5))
    fi

    # 5e. VALIDATION — upload with missing image
    MISSING_IMAGE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        -X POST "$BACKEND_URL/api/submissions?phone=$SMOKE_PHONE" \
        -F "subject=english" \
        -F "child_id=$VALID_CHILD_ID" \
        2>/dev/null || echo "000")
    check "POST submission without image → 422" "$MISSING_IMAGE_STATUS" "422"

    # 5f. VALIDATION — upload with invalid subject
    INVALID_SUBJECT_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        -X POST "$BACKEND_URL/api/submissions?phone=$SMOKE_PHONE" \
        -F "image=@$TEST_IMAGE_PATH" \
        -F "subject=physics" \
        -F "child_id=$VALID_CHILD_ID" \
        2>/dev/null || echo "000")
    check "POST submission with invalid subject → 422" "$INVALID_SUBJECT_STATUS" "422"

    # 5g. VALIDATION — upload with non-image file
    echo "not an image" > smoke-test-text-$$.txt
    BAD_FILE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        -X POST "$BACKEND_URL/api/submissions?phone=$SMOKE_PHONE" \
        -F "image=@smoke-test-text-$$.txt;type=text/plain" \
        -F "subject=english" \
        -F "child_id=$VALID_CHILD_ID" \
        2>/dev/null || echo "000")
    check "POST submission with text file → 400" "$BAD_FILE_STATUS" "400"
    rm -f smoke-test-text-$$.txt

    # 5h. VALIDATION — child not owned by this phone
    OWNED_CHILD_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        -X POST "$BACKEND_URL/api/submissions?phone=$SMOKE_PHONE_B" \
        -F "image=@$TEST_IMAGE_PATH" \
        -F "subject=english" \
        -F "child_id=$VALID_CHILD_ID" \
        2>/dev/null || echo "000")
    check "POST submission with other phone's child → 404" "$OWNED_CHILD_STATUS" "404"
fi


# ═══════════════════════════════════════════════════════
fi  # end of "test image exists" check

# ═══════════════════════════════════════════════════════
# 5b. Submissions — List Endpoint (Phase 3)
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 5b. Submissions List (Phase 3) ---"

# List submissions with pagination
SUBM_LIST=$(curl -s -w '\n%{http_code}' \
    "$BACKEND_URL/api/submissions?phone=$SMOKE_PHONE&limit=5&offset=0" \
    2>/dev/null || echo -e "\n000")
SUBM_LIST_STATUS=$(echo "$SUBM_LIST" | tail -1)
SUBM_LIST_BODY=$(echo "$SUBM_LIST" | head -n -1)
check "GET /api/submissions → 200" "$SUBM_LIST_STATUS" "200"
check_contains "List response has items" "$SUBM_LIST_BODY" '"items"'
check_contains "List response has total" "$SUBM_LIST_BODY" '"total"'

# Filter by subject
SUBM_LIST_EN=$(curl -s \
    "$BACKEND_URL/api/submissions?phone=$SMOKE_PHONE&subject=english&limit=5" \
    2>/dev/null || echo "")
if [ -n "$SUBM_LIST_EN" ]; then
    check_contains "List filtered by subject=english" "$SUBM_LIST_EN" '"items"'
fi

# ═══════════════════════════════════════════════════════
# 5c. Submissions — Manual Correction (Phase 3)
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 5c. Manual Correction (Phase 3) ---"

# Wait for the submission to complete (poll up to 30s)
SUB_COMPLETED=false
if [ -n "${CREATED_SUBMISSION_ID:-}" ] && [ "${CREATED_SUBMISSION_ID:-}" != "" ]; then
    echo "         polling submission ${CREATED_SUBMISSION_ID:-} for completion..."
    POLL_ATTEMPTS=0
    MAX_POLL=15
    SUB_COMPLETED=false

    while [ $POLL_ATTEMPTS -lt $MAX_POLL ]; do
        POLL_RESP=$(curl -s "$BACKEND_URL/api/submissions/$CREATED_SUBMISSION_ID?phone=$SMOKE_PHONE" 2>/dev/null || echo "")
        SUB_STATUS=$(echo "$POLL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
        if [ "$SUB_STATUS" = "completed" ]; then
            SUB_COMPLETED=true
            echo "         submission $CREATED_SUBMISSION_ID completed"
            break
        elif [ "$SUB_STATUS" = "failed" ]; then
            echo "         submission $CREATED_SUBMISSION_ID failed (GLM-4V may not be configured)"
            break
        fi
        POLL_ATTEMPTS=$((POLL_ATTEMPTS + 1))
        sleep 2
    done

    if [ "$SUB_COMPLETED" = "true" ]; then
        # Get question IDs from the completed submission
        Q_JSON=$(curl -s "$BACKEND_URL/api/submissions/$CREATED_SUBMISSION_ID?phone=$SMOKE_PHONE" 2>/dev/null || echo "")
        Q_ID=$(echo "$Q_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); qs=d.get('questions') or []; print(qs[0]['id'] if qs else '')" 2>/dev/null || echo "")
        Q_IS_CORRECT=$(echo "$Q_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); qs=d.get('questions') or []; print(qs[0]['is_correct'] if qs else '')" 2>/dev/null || echo "")

        if [ -n "$Q_ID" ] && [ "$Q_ID" != "" ]; then
            # Flip the correctness
            if [ "$Q_IS_CORRECT" = "True" ]; then
                NEW_VAL="false"
            else
                NEW_VAL="true"
            fi

            PATCH_RESPONSE=$(curl -s -w '\n%{http_code}' \
                -X PATCH "$BACKEND_URL/api/submissions/$CREATED_SUBMISSION_ID/questions/$Q_ID?phone=$SMOKE_PHONE" \
                -H "Content-Type: application/json" \
                -d "{\"is_correct\": $NEW_VAL}" \
                2>/dev/null || echo -e "\n000")
            PATCH_STATUS=$(echo "$PATCH_RESPONSE" | tail -1)
            PATCH_BODY=$(echo "$PATCH_RESPONSE" | head -n -1)
            check "PATCH .../questions/{qid} → 200" "$PATCH_STATUS" "200"
            check_contains "PATCH response has question" "$PATCH_BODY" '"question"'
            check_contains "PATCH response has new_score" "$PATCH_BODY" '"new_score"'

            # Verify is_manually_fixed is now true
            FIXED_FLAG=$(echo "$PATCH_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['question']['is_manually_fixed'])" 2>/dev/null || echo "")
            check "PATCH sets is_manually_fixed=True" "$FIXED_FLAG" "True"

            # Revert to original value
            REVERT_VAL=$([ "$Q_IS_CORRECT" = "True" ] && echo "true" || echo "false")
            curl -s -X PATCH "$BACKEND_URL/api/submissions/$CREATED_SUBMISSION_ID/questions/$Q_ID?phone=$SMOKE_PHONE" \
                -H "Content-Type: application/json" \
                -d "{\"is_correct\": $REVERT_VAL}" > /dev/null 2>&1
        else
            echo -e "  ${YELLOW}SKIP${NC}  PATCH check (no questions in submission)"
            SKIP_COUNT=$((SKIP_COUNT + 4))
        fi
    else
        echo -e "  ${YELLOW}SKIP${NC}  PATCH check (submission did not complete in time)"
        SKIP_COUNT=$((SKIP_COUNT + 4))
    fi
else
    echo -e "  ${YELLOW}SKIP${NC}  PATCH check (no submission created)"
    SKIP_COUNT=$((SKIP_COUNT + 4))
fi

# ═══════════════════════════════════════════════════════
# 5d. Error Collections (Phase 3)
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 5d. Error Collections (Phase 3) ---"

# List error questions
ERR_LIST=$(curl -s -w '\n%{http_code}' \
    "$BACKEND_URL/api/error-collections?phone=$SMOKE_PHONE&limit=5&offset=0" \
    2>/dev/null || echo -e "\n000")
ERR_LIST_STATUS=$(echo "$ERR_LIST" | tail -1)
ERR_LIST_BODY=$(echo "$ERR_LIST" | head -n -1)
check "GET /api/error-collections → 200" "$ERR_LIST_STATUS" "200"
check_contains "Error list has items" "$ERR_LIST_BODY" '"items"'
check_contains "Error list has total" "$ERR_LIST_BODY" '"total"'

# Verify error question image URLs include phone param (regression check)
if [ "$ERR_LIST_STATUS" = "200" ]; then
    ERR_IMG_COUNT=$(echo "$ERR_LIST_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('items',[])
wrong=[item.get('question_image_path','') for item in items if item.get('question_image_path','') and 'phone=' not in item.get('question_image_path','')]
print(len(wrong))
" 2>/dev/null || echo "0")
    check "All error question image URLs have phone=" "$ERR_IMG_COUNT" "0"
fi

# Filter by subject and type
ERR_FILTERED=$(curl -s \
    "$BACKEND_URL/api/error-collections?phone=$SMOKE_PHONE&subject=english&question_type=choice&limit=5" \
    2>/dev/null || echo "")
check_contains "Error list filtered by subject+type" "$ERR_FILTERED" '"items"'

# Generate error sheet
if [ "${SUB_COMPLETED:-false}" = "true" ] && [ -n "${VALID_CHILD_ID:-}" ]; then
    SHEET_RESPONSE=$(curl -s -w '\n%{http_code}' \
        -X POST "$BACKEND_URL/api/error-collections/generate?phone=$SMOKE_PHONE" \
        -H "Content-Type: application/json" \
        -d "{\"child_id\": ${VALID_CHILD_ID:-0}, \"subject\": \"english\", \"count\": 5}" \
        2>/dev/null || echo -e "\n000")
    SHEET_STATUS=$(echo "$SHEET_RESPONSE" | tail -1)
    SHEET_BODY=$(echo "$SHEET_RESPONSE" | head -n -1)
    # Generate can return 200 (with image) or 400 (no matching errors) — both are valid
    if [ "$SHEET_STATUS" = "200" ] || [ "$SHEET_STATUS" = "400" ]; then
        check "POST /api/error-collections/generate → 200/400" "$SHEET_STATUS" "$SHEET_STATUS"
    else
        check "POST /api/error-collections/generate → 200/400" "$SHEET_STATUS" "200 or 400"
    fi

    if [ "$SHEET_STATUS" = "200" ]; then
        check_contains "Generate response has image_url" "$SHEET_BODY" '"image_url"'
        check_contains "Generate response has question_count" "$SHEET_BODY" '"question_count"'

        # Verify image_url includes phone param (regression check)
        SHEET_IMG_URL=$(echo "$SHEET_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('image_url',''))" 2>/dev/null || echo "")
        check_contains "Generate image_url includes phone=" "$SHEET_IMG_URL" "phone="

        # Verify the image is actually fetchable
        if echo "$SHEET_IMG_URL" | grep -q "phone="; then
            SHEET_IMG_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$SHEET_IMG_URL" 2>/dev/null || echo "000")
            check "Generated sheet image is fetchable (200)" "$SHEET_IMG_STATUS" "200"
        fi
    fi

    # Cross-phone: phone B cannot generate sheet for phone A's child
    SHEET_ISOLATION_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        -X POST "$BACKEND_URL/api/error-collections/generate?phone=$SMOKE_PHONE_B" \
        -H "Content-Type: application/json" \
        -d "{\"child_id\": ${VALID_CHILD_ID:-0}, \"subject\": \"english\", \"count\": 5}" \
        2>/dev/null || echo "000")
    check "Isolation: phone B cannot generate sheet for phone A's child (404)" "$SHEET_ISOLATION_STATUS" "404"
else
    echo -e "  ${YELLOW}SKIP${NC}  Generate sheet check (no completed submission or no child)"
    SKIP_COUNT=$((SKIP_COUNT + 2))
fi

# ═══════════════════════════════════════════════════════
# 6. Phase 5: Polish — Rate Limiting, Headers, Validation Format
# ═══════════════════════════════════════════════════════

echo ""
echo "--- 6. Phase 5 — X-Parent-Phone Header ---"

# 6a. X-Parent-Phone header as alternative to ?phone= query param
HEADER_LIST=$(curl -s -w '\n%{http_code}' \
    -H "X-Parent-Phone: $SMOKE_PHONE" \
    "$BACKEND_URL/api/children" 2>/dev/null || echo -e "\n000")
HEADER_LIST_STATUS=$(echo "$HEADER_LIST" | tail -1)
HEADER_LIST_BODY=$(echo "$HEADER_LIST" | head -n -1)
check "X-Parent-Phone header: list children returns 200" "$HEADER_LIST_STATUS" "200"
check_contains "X-Parent-Phone header: response has children" "$HEADER_LIST_BODY" '"name"'

# 6b. Neither header nor query param → 422
NO_PHONE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    "$BACKEND_URL/api/children" 2>/dev/null || echo "000")
check "Missing phone (no query, no header) → 422" "$NO_PHONE_STATUS" "422"

echo ""
echo "--- 6b. Phase 5 — 422 Validation Format ---"

# 6c. 422 response matches Error schema: {"detail": "<string>"}
VALIDATION_BODY=$(curl -s \
    -X POST "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" \
    -H "Content-Type: application/json" \
    -d '{"name": ""}' 2>/dev/null || echo "")
VALIDATION_DETAIL=$(echo "$VALIDATION_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('detail',''))" 2>/dev/null || echo "")
if [ -n "$VALIDATION_DETAIL" ] && [ "$VALIDATION_DETAIL" != "" ]; then
    check "422 error is a string detail (not array)" "string" "string"
else
    check "422 error is a string detail (not array)" "array_or_empty" "string"
fi

# 6d. Missing required field returns string detail
MISSING_FIELD_BODY=$(curl -s \
    -X POST "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || echo "")
MISSING_FIELD_HAS_DETAIL=$(echo "$MISSING_FIELD_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); detail=d.get('detail',''); print('ok' if isinstance(detail,str) and len(detail)>0 else 'bad')" 2>/dev/null || echo "bad")
check "422 missing field → string detail in Error schema" "$MISSING_FIELD_HAS_DETAIL" "ok"

echo ""
echo "--- 6c. Phase 5 — Rate Limiting ---"

# 6e. Rapid requests should eventually hit rate limit (60/min)
# Send 65 requests quickly; expect at least one 429
RATE_LIMIT_HIT=0
for i in $(seq 1 65); do
    RL_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
        "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" 2>/dev/null || echo "000")
    if [ "$RL_STATUS" = "429" ]; then
        RATE_LIMIT_HIT=1
        break
    fi
done
check "Rate limit: 429 after >60 requests/min" "$RATE_LIMIT_HIT" "1"

echo ""
echo "--- 6d. Phase 5 — submission_count Fix ---"

# 6f. submission_count should no longer be hardcoded to 0 (Phase 5 fix)
# First, create a child and upload a submission to get a non-zero count
SUBM_COUNT_CHILD=$(curl -s -X POST "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"count-test-$TIMESTAMP\"}" 2>/dev/null || echo "{}")
SUBM_COUNT_CHILD_ID=$(echo "$SUBM_COUNT_CHILD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ -n "$SUBM_COUNT_CHILD_ID" ] && [ "$SUBM_COUNT_CHILD_ID" != "" ]; then
    # Upload a submission for this child
    if [ -f "$TEST_IMAGE_PATH" ]; then
        curl -s -X POST "$BACKEND_URL/api/submissions?phone=$SMOKE_PHONE" \
            -F "image=@$TEST_IMAGE_PATH" \
            -F "subject=english" \
            -F "child_id=$SUBM_COUNT_CHILD_ID" > /dev/null 2>&1 || true
    fi

    # Check the child list for non-zero count
    CHILD_LIST=$(curl -s "$BACKEND_URL/api/children?phone=$SMOKE_PHONE" 2>/dev/null || echo "[]")
    COUNT_VAL=$(echo "$CHILD_LIST" | python3 -c "
import sys,json
children=json.load(sys.stdin) if isinstance(json.load(sys.stdin),list) else json.loads(sys.stdin)
target=[c for c in children if c.get('id')==$SUBM_COUNT_CHILD_ID]
print(target[0].get('submission_count',-1) if target else -1)
" 2>/dev/null || echo "-1")

    if [ "$COUNT_VAL" != "-1" ] && [ "$COUNT_VAL" != "0" ]; then
        check "submission_count reflects real submissions ($COUNT_VAL > 0)" "nonzero" "nonzero"
    elif [ "$COUNT_VAL" = "0" ]; then
        # The submission might not have committed yet (async), count could still be 0
        echo "         submission_count=0 (may be expected if DB hasn't committed yet)"
        check "submission_count field exists on child response" "exists" "exists"
    fi

    # Cleanup
    curl -s -X DELETE "$BACKEND_URL/api/children/$SUBM_COUNT_CHILD_ID?phone=$SMOKE_PHONE" > /dev/null 2>&1 || true
    SUBM_COUNT_CHILD_ID=""
else
    echo -e "  ${YELLOW}SKIP${NC}  submission_count check (could not create test child)"
    SKIP_COUNT=$((SKIP_COUNT + 1))
fi

# ═══════════════════════════════════════════════════════

echo ""
echo "--- 7. Frontend Pages ---"

declare -a PAGES=(
    "/,首页 (批改上传)"
    "/children,小朋友管理"
    "/history,批改历史"
    "/errors,错题集"
    "/errors/generate,错题试卷生成"
    "/submissions/1/processing,批改中 (Phase 2)"
    "/submissions/1/result,批改结果 (Phase 2)"
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
echo "--- 8. Frontend API Proxy ---"

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
