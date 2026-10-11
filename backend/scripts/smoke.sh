#!/usr/bin/env bash
set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@feedbackiq.local}"
ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-AdminPassword123!}"
VIEWER_EMAIL="${SEED_VIEWER_EMAIL:-viewer@feedbackiq.local}"
VIEWER_PASSWORD="${SEED_VIEWER_PASSWORD:-ViewerPassword123!}"

echo "=========================================="
echo " FeedbackIQ Smoke Test Suite (Bash) "
echo "=========================================="

# Step 1: Admin Login
echo -n "[1/8] Admin Login... "
COOKIE_JAR=$(mktemp)
LOGIN_RESP=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

if echo "$LOGIN_RESP" | grep -q '"role":"ADMIN"'; then
  echo "PASS"
else
  echo "FAIL: $LOGIN_RESP"
  exit 1
fi

# Step 2: Unauthenticated /api/feedback read blocked (401)
echo -n "[2/8] Public read access blocked (401)... "
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/feedback")
if [ "$UNAUTH_STATUS" -eq 401 ]; then
  echo "PASS"
else
  echo "FAIL (Expected 401, got $UNAUTH_STATUS)"
  exit 1
fi

# Step 3: Create Feedback (Public POST)
echo -n "[3/8] Create Feedback (Public)... "
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{"message":"Smoke test message for automated verification","productName":"Smoke Test","source":"web"}')

FEEDBACK_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
if [ -n "$FEEDBACK_ID" ]; then
  echo "PASS (ID: $FEEDBACK_ID)"
else
  echo "FAIL: $CREATE_RESP"
  exit 1
fi

# Step 4: List Feedback as Admin
echo -n "[4/8] List Feedback as Admin... "
LIST_RESP=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/feedback?pageSize=5")
if echo "$LIST_RESP" | grep -q '"total":'; then
  echo "PASS"
else
  echo "FAIL: $LIST_RESP"
  exit 1
fi

# Step 5: Viewer Login & Forbidden Action Check (403)
echo -n "[5/8] Viewer Forbidden Action (403)... "
VIEWER_JAR=$(mktemp)
curl -s -c "$VIEWER_JAR" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$VIEWER_EMAIL\",\"password\":\"$VIEWER_PASSWORD\"}" > /dev/null

PATCH_FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$VIEWER_JAR" -X PATCH "$BASE_URL/api/feedback/$FEEDBACK_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED"}')

if [ "$PATCH_FORBIDDEN_STATUS" -eq 403 ]; then
  echo "PASS"
else
  echo "FAIL (Expected 403, got $PATCH_FORBIDDEN_STATUS)"
  exit 1
fi

# Step 6: Admin Patch Status
echo -n "[6/8] Admin Update Status (PATCH)... "
PATCH_RESP=$(curl -s -b "$COOKIE_JAR" -X PATCH "$BASE_URL/api/feedback/$FEEDBACK_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"RESOLVED"}')

if echo "$PATCH_RESP" | grep -q '"status":"RESOLVED"'; then
  echo "PASS"
else
  echo "FAIL: $PATCH_RESP"
  exit 1
fi

# Step 7: Analytics Summary as Admin
echo -n "[7/8] Analytics Summary... "
ANALYTICS_RESP=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/analytics/summary?days=30")
if echo "$ANALYTICS_RESP" | grep -q '"highPriorityCount":'; then
  echo "PASS"
else
  echo "FAIL: $ANALYTICS_RESP"
  exit 1
fi

# Step 8: Export CSV
echo -n "[8/8] Export CSV... "
EXPORT_HEADER=$(curl -s -i -b "$COOKIE_JAR" "$BASE_URL/api/feedback/export" | grep -i "Content-Type: text/csv")
if [ -n "$EXPORT_HEADER" ]; then
  echo "PASS"
else
  echo "FAIL: Could not verify CSV Content-Type header"
  exit 1
fi

echo "=========================================="
echo " ALL SMOKE TESTS PASSED SUCCESSFULLY! "
echo "=========================================="
