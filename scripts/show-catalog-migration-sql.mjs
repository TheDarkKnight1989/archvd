import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const migrationFile = join(__dirname, '../supabase/migrations/20251125_alias_catalog_items.sql')
const sql = fs.readFileSync(migrationFile, 'utf8')

console.log('📋 SQL to run in Supabase SQL Editor:')
console.log('=' .repeat(80))
console.log(sql)
console.log('='.repeat(80))
console.log('\n📝 Copy the SQL above and run it in Supabase SQL Editor')
console.log('   Then refresh the inventory page to see images!')
