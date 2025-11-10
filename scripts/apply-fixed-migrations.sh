#!/bin/bash

# Apply FIXED migrations for existing database with FX columns
# Usage: ./scripts/apply-fixed-migrations.sh M2
#    or: ./scripts/apply-fixed-migrations.sh M4
#    or: ./scripts/apply-fixed-migrations.sh all

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL not set${NC}"
  echo "Please set it in your .env.local or export it:"
  echo "  export DATABASE_URL='postgresql://...'"
  exit 1
fi

# Function to apply a migration
apply_migration() {
  local migration_id=$1
  local filename=$2
  
  echo -e "\n${BLUE}🚀 Applying FIXED migration: ${migration_id}${NC}"
  echo -e "${BLUE}📄 File: ${filename}${NC}\n"
  
  local filepath="supabase/migrations/${filename}"
  
  if [ ! -f "$filepath" ]; then
    echo -e "${RED}❌ File not found: ${filepath}${NC}"
    exit 1
  fi
  
  echo "⚙️  Executing SQL..."
  
  if psql "$DATABASE_URL" -f "$filepath" -v ON_ERROR_STOP=1; then
    echo -e "\n${GREEN}✅ Migration ${migration_id} applied successfully!${NC}\n"
  else
    echo -e "\n${RED}❌ Migration ${migration_id} failed!${NC}\n"
    exit 1
  fi
}

# Main logic
case "$1" in
  M2|m2)
    apply_migration "M2" "20251115_M2_clean.sql"
    ;;
  M4|m4)
    apply_migration "M4" "20251117_views_and_observability_FIXED.sql"
    ;;
  all|ALL)
    echo -e "${YELLOW}📦 Applying all FIXED migrations in sequence...${NC}"
    apply_migration "M2" "20251115_M2_clean.sql"
    apply_migration "M4" "20251117_views_and_observability_FIXED.sql"
    echo -e "\n${GREEN}✅ All FIXED migrations applied successfully!${NC}\n"
    ;;
  *)
    echo -e "${RED}❌ Invalid migration ID: $1${NC}"
    echo "Usage: $0 [M2|M4|all]"
    echo ""
    echo "Examples:"
    echo "  $0 M2      # Apply M2 FIXED migration only"
    echo "  $0 M4      # Apply M4 FIXED migration only"
    echo "  $0 all     # Apply all FIXED migrations"
    exit 1
    ;;
esac

echo -e "${GREEN}🎉 Done!${NC}"
