import os
import json
import base64
import tempfile
import threading
from dotenv import load_dotenv
from google.cloud import bigquery
import pymssql

load_dotenv()


# ─── SQL Server Connection (main data tables) ─────────────────────────────────
SQL_SERVER_HOST     = os.getenv("SQL_SERVER_HOST", "")
SQL_SERVER_PORT     = int(os.getenv("SQL_SERVER_PORT", "1433"))
SQL_SERVER_USER     = os.getenv("SQL_SERVER_USER", "")
SQL_SERVER_PASSWORD = os.getenv("SQL_SERVER_PASSWORD", "")
SQL_SERVER_DATABASE = os.getenv("SQL_SERVER_DATABASE", "evolve_spa")

_connection_lock = threading.Lock()
_connection_pool = []


def get_sql_connection():
    """Get a healthy connection from the pool, or create a new one.

    The health check (SELECT 1) is run OUTSIDE the lock. Previously it ran while
    holding _connection_lock, so a single slow/dead pooled connection would hang
    EVERY other thread's checkout for the full query timeout — catastrophic now
    that the timeout is 30s and the KPI header checks out up to 8 connections
    concurrently (it serialized the whole "parallel" header back to ~30s). Here we
    only hold the lock to pop a candidate; validation happens lock-free, and dead
    connections are closed (never re-pooled) so they can't poison later checkouts.
    """
    global _connection_pool
    while True:
        with _connection_lock:
            conn = _connection_pool.pop() if _connection_pool else None
        if conn is None:
            break
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchall()
            cursor.close()
            return conn
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            # try the next pooled connection, else fall through to create a fresh one

    try:
        conn = pymssql.connect(
            server=SQL_SERVER_HOST,
            port=SQL_SERVER_PORT,
            user=SQL_SERVER_USER,
            password=SQL_SERVER_PASSWORD,
            database=SQL_SERVER_DATABASE,
            # Query timeout (seconds). 10s was too tight for the heavier analytical
            # queries (KPI header, operations-summary) when two views load them
            # concurrently — they compete for DB resources and intermittently tip
            # past 10s, returning 500s. 30s absorbs those concurrent-load spikes
            # while staying under the gateway timeout. (login_timeout stays default.)
            timeout=30,
            charset='UTF-8'
        )
        print(f"[OK] Connected to SQL Server: {SQL_SERVER_HOST}:{SQL_SERVER_PORT}")
        return conn
    except pymssql.DatabaseError as exc:
        raise RuntimeError(f"Failed to connect to SQL Server: {exc}") from exc


def return_sql_connection(conn):
    """Return a connection to the pool."""
    global _connection_pool
    try:
        with _connection_lock:
            if len(_connection_pool) < 5:
                _connection_pool.append(conn)
            else:
                conn.close()
    except Exception:
        pass


# ─── BigQuery Credentials (api_log, insights, error tables only) ──────────────
def _setup_credentials() -> bool:
    """Returns True if credentials were found, False otherwise (non-fatal)."""
    creds_b64  = os.getenv("BIGQUERY_CREDENTIALS_BASE64")
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if creds_b64:
        try:
            creds_json = base64.b64decode(creds_b64).decode("utf-8")
            creds_dict = json.loads(creds_json)
            tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
            tmp.write(json.dumps(creds_dict))
            tmp.close()
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
            print(f"[OK] BQ credentials loaded from Base64 -> {tmp.name}")
            return True
        except Exception as exc:
            print(f"[WARN] Failed to decode BIGQUERY_CREDENTIALS_BASE64: {exc}")
            return False

    if creds_path:
        if os.path.exists(creds_path):
            print(f"[OK] BQ credentials loaded from file -> {creds_path}")
            return True
        print(f"[WARN] BQ credentials file not found: {creds_path}")
        return False

    print("[WARN] No BQ credentials found - insights/api_log features will be unavailable.")
    return False


_BQ_AVAILABLE = _setup_credentials()
try:
    BQ_CLIENT: bigquery.Client = bigquery.Client() if _BQ_AVAILABLE else None
except Exception as _bq_exc:
    print(f"[WARN] Could not create BigQuery client: {_bq_exc}")
    BQ_CLIENT = None


# ─── SQL Server table identifiers ─────────────────────────────────────────────
SALES_TABLE    = os.getenv("SQL_SALES_TABLE",    "dbo.sales_accrual")
SCHEDULE_TABLE = os.getenv("SQL_SCHEDULE_TABLE", "dbo.employee_schedule")
APPT_TABLE     = os.getenv("SQL_APPT_TABLE",     "dbo.appointments")
CASH_TABLE     = os.getenv("SQL_CASH_TABLE",     "dbo.BRONZE_ZENOTI_CASH_COLLECTIONS")
COGS_TABLE     = os.getenv("SQL_COGS_TABLE",     "dbo.BRONZE_ZENOTI_COST_OF_GOODS")
MEMBERSHIP_TABLE = os.getenv("SQL_MEMBERSHIP_TABLE", "dbo.Bi_DimMembershipUser_s3")
MEMBERSHIP_SALES_TABLE = os.getenv("SQL_MEMBERSHIP_SALES_TABLE", "dbo.BRONZE_ZENOTI_MEMBERSHIPS_SALES")
BUSINESS_KPI_TABLE = os.getenv("SQL_BUSINESS_KPI_TABLE", "dbo.BRONZE_ZENOTI_BUSINESS_KPI")
FACT_COLLECTIONS_TABLE = os.getenv("SQL_FACT_COLLECTIONS_TABLE", "dbo.Bi_FactCollections_s3")

# Aliases used by routers — plain table names work for SQL Server
FULL_SALES    = SALES_TABLE
FULL_SCHEDULE = SCHEDULE_TABLE
FULL_APPT     = APPT_TABLE
FULL_CASH     = CASH_TABLE
FULL_COGS     = COGS_TABLE
FULL_MEMBERSHIP = MEMBERSHIP_TABLE
FULL_MEMBERSHIP_SALES = MEMBERSHIP_SALES_TABLE
FULL_BUSINESS_KPI = BUSINESS_KPI_TABLE
FULL_FACT_COLLECTIONS = FACT_COLLECTIONS_TABLE

# ─── Overlay (fill the gap when bronze lags the live site) ────────────────────
# When OVERLAY_ENABLED=true, read through the gap-fill VIEWS (bronze UNION ALL
# overlay-for-missing-dates) instead of the bronze tables. Views are drop-in
# table replacements, so no query changes are needed. FIRST run
# data/overlay/overlay_setup.sql in SQL (creates OVERLAY_* staging + V_* views);
# regenerate it with scripts/build_overlay_sql.py after dropping new CSV exports
# in data/overlay/. To disable: set OVERLAY_ENABLED=false (or drop the views).
OVERLAY_ENABLED = os.getenv("OVERLAY_ENABLED", "false").lower() == "true"
if OVERLAY_ENABLED:
    FULL_SALES    = "dbo.V_ZENOTI_SALES_ACCRUAL"
    FULL_CASH     = "dbo.V_ZENOTI_CASH_COLLECTIONS"
    FULL_COGS     = "dbo.V_ZENOTI_COST_OF_GOODS"
    FULL_APPT     = "dbo.V_ZENOTI_APPOINTMENTS"
    FULL_SCHEDULE = "dbo.V_ZENOTI_EMPLOYEE_SCHEDULES"


# ─── BigQuery table identifiers (api_log, insights, errors) ───────────────────
PROJECT_ID     = os.getenv("BIGQUERY_PROJECT_ID", "your-project-id")
DATASET        = os.getenv("BIGQUERY_DATASET",    "your_dataset")
API_LOG_TABLE  = os.getenv("BIGQUERY_API_LOG_TABLE",  "api_log")
INSIGHTS_TABLE = os.getenv("BIGQUERY_INSIGHTS_TABLE", "ai_insights_log")

# Backtick-quoted for BigQuery SQL queries
FULL_API_LOG   = f"`{PROJECT_ID}.{DATASET}.{API_LOG_TABLE}`"
FULL_INSIGHTS  = f"`{PROJECT_ID}.{DATASET}.{INSIGHTS_TABLE}`"

# Plain dotted for BigQuery streaming inserts (insert_rows_json)
PLAIN_API_LOG  = f"{PROJECT_ID}.{DATASET}.{API_LOG_TABLE}"
PLAIN_INSIGHTS = f"{PROJECT_ID}.{DATASET}.{INSIGHTS_TABLE}"