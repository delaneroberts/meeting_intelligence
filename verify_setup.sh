#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        Meeting Intelligence - Setup Verification              ║"
echo "║                                                                ║"
echo "║        Checking parallel project configuration...             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASS_COUNT++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAIL_COUNT++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

# Check directories
echo "📂 Directory Structure"
[ -d "/Users/delaneroberts/meeting_intelligence/backend" ] && pass "backend/ directory exists" || fail "backend/ directory missing"
[ -d "/Users/delaneroberts/meeting_intelligence/static" ] && pass "static/ directory exists" || fail "static/ directory missing"
[ -d "/Users/delaneroberts/meeting_intelligence/templates" ] && pass "templates/ directory exists" || fail "templates/ directory missing"
[ -d "/Users/delaneroberts/meeting_intelligence/uploads" ] && pass "uploads/ directory exists" || fail "uploads/ directory missing"
[ -d "/Users/delaneroberts/meeting_intelligence/transcripts" ] && pass "transcripts/ directory exists" || fail "transcripts/ directory missing"
[ -d "/Users/delaneroberts/meeting_intelligence/logs" ] && pass "logs/ directory exists" || fail "logs/ directory missing"
echo ""

# Check backend modules
echo "🐍 Backend Modules"
[ -f "/Users/delaneroberts/meeting_intelligence/backend/config.py" ] && pass "config.py exists" || fail "config.py missing"
[ -f "/Users/delaneroberts/meeting_intelligence/backend/models.py" ] && pass "models.py exists" || fail "models.py missing"
[ -f "/Users/delaneroberts/meeting_intelligence/backend/services/transcription.py" ] && pass "transcription.py exists" || fail "transcription.py missing"
[ -f "/Users/delaneroberts/meeting_intelligence/backend/services/translation.py" ] && pass "translation.py exists" || fail "translation.py missing"
[ -f "/Users/delaneroberts/meeting_intelligence/backend/services/summarization.py" ] && pass "summarization.py exists" || fail "summarization.py missing"
[ -f "/Users/delaneroberts/meeting_intelligence/backend/services/qa_detection.py" ] && pass "qa_detection.py exists" || fail "qa_detection.py missing"
[ -f "/Users/delaneroberts/meeting_intelligence/backend/services/export.py" ] && pass "export.py exists" || fail "export.py missing"
[ -f "/Users/delaneroberts/meeting_intelligence/backend/routes/api.py" ] && pass "api.py exists" || fail "api.py missing"
echo ""

# Check frontend files
echo "🖥️  Frontend Files"
[ -f "/Users/delaneroberts/meeting_intelligence/static/script.js" ] && pass "script.js exists" || fail "script.js missing"
[ -f "/Users/delaneroberts/meeting_intelligence/templates/index.html" ] && pass "index.html exists" || fail "index.html missing"
echo ""

# Check main app
echo "📱 Main Application"
[ -f "/Users/delaneroberts/meeting_intelligence/app.py" ] && pass "app.py exists" || fail "app.py missing"
[ -f "/Users/delaneroberts/meeting_intelligence/requirements.txt" ] && pass "requirements.txt exists" || fail "requirements.txt missing"
echo ""

# Check configuration
echo "⚙️  Configuration"
if grep -q "FLASK_PORT = int(os.getenv(\"FLASK_PORT\", 8001))" /Users/delaneroberts/meeting_intelligence/backend/config.py; then
    pass "Config: Default port set to 8001"
else
    fail "Config: Default port NOT set to 8001"
fi

if grep -q "meeting_intelligence.db" /Users/delaneroberts/meeting_intelligence/backend/config.py; then
    pass "Config: Database is meeting_intelligence.db"
else
    fail "Config: Database NOT set to meeting_intelligence.db"
fi
echo ""

# Check Python syntax
echo "🐍 Python Syntax"
python3 -m py_compile /Users/delaneroberts/meeting_intelligence/backend/config.py 2>/dev/null && pass "config.py: Valid Python syntax" || fail "config.py: Invalid Python syntax"
python3 -m py_compile /Users/delaneroberts/meeting_intelligence/backend/models.py 2>/dev/null && pass "models.py: Valid Python syntax" || fail "models.py: Invalid Python syntax"
python3 -m py_compile /Users/delaneroberts/meeting_intelligence/app.py 2>/dev/null && pass "app.py: Valid Python syntax" || fail "app.py: Invalid Python syntax"
echo ""

# Test imports
echo "📦 Import Tests"
cd /Users/delaneroberts/meeting_intelligence
python3 -c "from backend.config import FLASK_PORT; print(FLASK_PORT)" > /dev/null 2>&1 && pass "Import: backend.config works" || fail "Import: backend.config failed"
python3 -c "from backend.models import db" > /dev/null 2>&1 && pass "Import: backend.models works" || fail "Import: backend.models failed"
python3 -c "from backend.services import transcription" > /dev/null 2>&1 && pass "Import: backend.services works" || fail "Import: backend.services failed"
echo ""

# Check isolation
echo "🔒 Isolation Checks"
if [ -f "/Users/delaneroberts/meeting_assistant/meeting_assistant.db" ] || [ -f "/Users/delaneroberts/meeting_assistant/meeting_assistant.db" != "/Users/delaneroberts/meeting_intelligence/meeting_intelligence.db" ]; then
    pass "Isolation: Separate database files"
else
    fail "Isolation: Databases may not be separate"
fi

if [ -d "/Users/delaneroberts/meeting_assistant/transcripts" ] && [ -d "/Users/delaneroberts/meeting_intelligence/transcripts" ]; then
    pass "Isolation: Separate transcript folders"
else
    fail "Isolation: Transcript folders not both present"
fi
echo ""

# Port configuration check
echo "🔌 Port Configuration"
PORT_SETTING=$(cd /Users/delaneroberts/meeting_intelligence && python3 -c "from backend.config import FLASK_PORT; print(FLASK_PORT)" 2>/dev/null)
if [ "$PORT_SETTING" = "8001" ]; then
    pass "Port: meeting_intelligence default is 8001"
else
    fail "Port: meeting_intelligence default is not 8001 (got: $PORT_SETTING)"
fi

ASSISTANT_PORT=$(cd /Users/delaneroberts/meeting_assistant && python3 -c "from backend.config import FLASK_PORT; print(FLASK_PORT)" 2>/dev/null)
if [ "$ASSISTANT_PORT" = "8000" ]; then
    pass "Port: meeting_assistant default is 8000"
else
    fail "Port: meeting_assistant default is not 8000 (got: $ASSISTANT_PORT)"
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Verification Summary                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "✅ PASSED: ${GREEN}$PASS_COUNT${NC}"
echo -e "❌ FAILED: ${RED}$FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "🚀 Ready to start meeting_intelligence:"
    echo "   cd /Users/delaneroberts/meeting_intelligence"
    echo "   export FLASK_PORT=8001"
    echo "   python3 app.py"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Review the errors above.${NC}"
    exit 1
fi
