#!/bin/bash
# ============================================================
#  PRODENT — Stop all services
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PGSQL_BIN="$HOME/tools/pgsql/bin"
PGDATA="$HOME/tools/pgdata"
REDIS_BIN="$HOME/tools/redis-stable/src"
LOG_DIR="$PROJECT_DIR/.logs"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${CYAN}${BOLD}  Stopping PRODENT...${NC}"
echo ""

# Frontend
if [ -f "$LOG_DIR/frontend.pid" ]; then
  PID=$(cat "$LOG_DIR/frontend.pid")
  kill $PID 2>/dev/null && echo -e "  ${GREEN}Frontend stopped${NC}" || echo -e "  ${YELLOW}Frontend was not running${NC}"
  rm -f "$LOG_DIR/frontend.pid"
else
  # Try to find by port
  PID=$(lsof -ti :5173 2>/dev/null)
  [ -n "$PID" ] && kill $PID 2>/dev/null && echo -e "  ${GREEN}Frontend stopped${NC}" || echo -e "  ${YELLOW}Frontend was not running${NC}"
fi

# Backend
if [ -f "$LOG_DIR/backend.pid" ]; then
  PID=$(cat "$LOG_DIR/backend.pid")
  kill $PID 2>/dev/null && echo -e "  ${GREEN}Backend stopped${NC}" || echo -e "  ${YELLOW}Backend was not running${NC}"
  rm -f "$LOG_DIR/backend.pid"
else
  PID=$(lsof -ti :8080 2>/dev/null)
  [ -n "$PID" ] && kill $PID 2>/dev/null && echo -e "  ${GREEN}Backend stopped${NC}" || echo -e "  ${YELLOW}Backend was not running${NC}"
fi

# Redis
"$REDIS_BIN/redis-cli" shutdown 2>/dev/null && echo -e "  ${GREEN}Redis stopped${NC}" || echo -e "  ${YELLOW}Redis was not running${NC}"

# PostgreSQL
"$PGSQL_BIN/pg_ctl" -D "$PGDATA" stop -m fast 2>/dev/null && echo -e "  ${GREEN}PostgreSQL stopped${NC}" || echo -e "  ${YELLOW}PostgreSQL was not running${NC}"

echo ""
echo -e "${GREEN}${BOLD}  All services stopped.${NC}"
echo ""
