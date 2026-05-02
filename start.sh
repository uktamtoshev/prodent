#!/bin/bash
# ============================================================
#  PRODENT — One-click start script
#  Запускает: PostgreSQL, Redis, Java Backend, React Frontend
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PGSQL_BIN="$HOME/tools/pgsql/bin"
PGDATA="$HOME/tools/pgdata"
REDIS_BIN="$HOME/tools/redis-stable/src"
MAVEN_BIN="$HOME/tools/apache-maven-3.9.6/bin"
NODE_BIN="$HOME/.nvm/versions/node/v20.20.2/bin"
BACKEND_DIR="$PROJECT_DIR/prodent-backend"
FRONTEND_DIR="$PROJECT_DIR/prodent-frontend"
LOG_DIR="$PROJECT_DIR/.logs"

export PATH="$NODE_BIN:$PGSQL_BIN:$REDIS_BIN:$MAVEN_BIN:$PATH"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

mkdir -p "$LOG_DIR"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║        🦷  PRODENT  Platform         ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── Function: check if port is in use ──────────────────────
port_in_use() {
  lsof -i :$1 -sTCP:LISTEN >/dev/null 2>&1
}

# ─── 1. PostgreSQL ──────────────────────────────────────────
echo -e "${YELLOW}[1/4]${NC} PostgreSQL..."
if port_in_use 5432; then
  echo -e "       ${GREEN}Already running on :5432${NC}"
else
  "$PGSQL_BIN/pg_ctl" -D "$PGDATA" -l "$LOG_DIR/postgresql.log" start -w >/dev/null 2>&1
  if port_in_use 5432; then
    echo -e "       ${GREEN}Started on :5432${NC}"
  else
    echo -e "       ${RED}FAILED — see $LOG_DIR/postgresql.log${NC}"
    exit 1
  fi
fi

# ─── 2. Redis ───────────────────────────────────────────────
echo -e "${YELLOW}[2/4]${NC} Redis..."
if port_in_use 6379; then
  echo -e "       ${GREEN}Already running on :6379${NC}"
else
  "$REDIS_BIN/redis-server" --daemonize yes --logfile "$LOG_DIR/redis.log" >/dev/null 2>&1
  sleep 1
  if port_in_use 6379; then
    echo -e "       ${GREEN}Started on :6379${NC}"
  else
    echo -e "       ${RED}FAILED — see $LOG_DIR/redis.log${NC}"
    exit 1
  fi
fi

# ─── 3. Java Backend ───────────────────────────────────────
echo -e "${YELLOW}[3/4]${NC} Java Backend (Spring Boot)..."
if port_in_use 8080; then
  echo -e "       ${GREEN}Already running on :8080${NC}"
else
  cd "$BACKEND_DIR"
  "$MAVEN_BIN/mvn" spring-boot:run -q > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo $BACKEND_PID > "$LOG_DIR/backend.pid"

  # Wait up to 60 seconds for backend to start
  echo -n "       Waiting..."
  for i in $(seq 1 60); do
    if port_in_use 8080; then
      echo ""
      echo -e "       ${GREEN}Started on :8080 (PID $BACKEND_PID)${NC}"
      break
    fi
    # Check if process died
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
      echo ""
      echo -e "       ${RED}FAILED — see $LOG_DIR/backend.log${NC}"
      exit 1
    fi
    echo -n "."
    sleep 1
  done

  if ! port_in_use 8080; then
    echo ""
    echo -e "       ${RED}TIMEOUT — see $LOG_DIR/backend.log${NC}"
    exit 1
  fi
fi

# ─── 4. React Frontend ─────────────────────────────────────
echo -e "${YELLOW}[4/4]${NC} React Frontend (Vite)..."
if port_in_use 5173; then
  echo -e "       ${GREEN}Already running on :5173${NC}"
else
  cd "$FRONTEND_DIR"
  "$NODE_BIN/npx" vite --port 5173 --host > "$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"

  # Wait up to 15 seconds
  for i in $(seq 1 15); do
    if port_in_use 5173; then
      break
    fi
    sleep 1
  done

  if port_in_use 5173; then
    echo -e "       ${GREEN}Started on :5173 (PID $FRONTEND_PID)${NC}"
  else
    echo -e "       ${RED}FAILED — see $LOG_DIR/frontend.log${NC}"
    exit 1
  fi
fi

# ─── Done ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  All services are running!${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  http://localhost:5173"
echo -e "  ${CYAN}Backend:${NC}   http://localhost:8080"
echo -e "  ${CYAN}API Docs:${NC}  http://localhost:8080/swagger-ui.html"
echo -e "  ${CYAN}DB:${NC}        localhost:5432  (prodent/prodent)"
echo ""
echo -e "  ${YELLOW}Test login:${NC}  admin@prodent.uz / Test123!"
echo ""
echo -e "  ${CYAN}Logs:${NC}      $LOG_DIR/"
echo -e "  ${CYAN}Stop all:${NC}  ./stop.sh"
echo ""

# Open browser
if command -v open &>/dev/null; then
  open "http://localhost:5173"
fi
