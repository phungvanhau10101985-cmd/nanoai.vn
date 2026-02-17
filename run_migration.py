import requests
import json
import os
from pathlib import Path

# Supabase configuration
SUPABASE_URL = "https://mxwfxudyeoqstgwmlupa.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14d2Z4dWR5ZW9xc3Rnd21sdXBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU5NDc1MiwiZXhwIjoyMDg2MTcwNzUyfQ.5RUxdsaEWpT84wp6xfCaUqDxh2r8n8RoPPV6S-TfL7E"

def run_sql_migration():
    # Read SQL file
    sql_file = Path("migrations/create_payments_table.sql")
    if not sql_file.exists():
        print(f"SQL file not found: {sql_file}")
        return False
    
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print(f"Read SQL file: {sql_file}")
    print(f"SQL content length: {len(sql_content)} characters")
    
    # Prepare headers
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try to execute SQL using Supabase REST API
    # Note: Supabase doesn't have a direct SQL execution endpoint via REST
    # We need to use the SQL Editor in the dashboard or pgAdmin
    
    print("\n" + "="*60)
    print("SQL MIGRATION SCRIPT")
    print("="*60)
    print("\nTo run this SQL migration, please follow these steps:")
    print("\n1. Go to Supabase Dashboard:")
    print("   https://app.supabase.com/project/mxwfxudyeoqstgwmlupa")
    print("\n2. Navigate to SQL Editor:")
    print("   In the left sidebar, click 'SQL Editor'")
    print("\n3. Create a new query:")
    print("   Click 'New query' button")
    print("\n4. Copy and paste the following SQL:")
    print("\n" + "="*60)
    print(sql_content)
    print("="*60)
    
    return True

if __name__ == "__main__":
    print("Starting SQL migration for Thu Do Online payment system...")
    success = run_sql_migration()
    
    if success:
        print("\n✅ Migration script prepared successfully!")
        print("\n📋 Next steps:")
        print("1. Run the SQL in Supabase SQL Editor")
        print("2. Verify tables were created")
        print("3. Test the payment system")
    else:
        print("\n❌ Failed to prepare migration script")