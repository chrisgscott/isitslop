import os
from datetime import datetime, timezone
from supabase import create_client


def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def update_analysis_status(analysis_id: str, status: str):
    sb = get_supabase()
    sb.table("analyses").update({"status": status}).eq("id", analysis_id).execute()


def update_analysis_error(analysis_id: str, error_message: str):
    sb = get_supabase()
    sb.table("analyses").update({
        "status": "error",
        "error_message": error_message,
    }).eq("id", analysis_id).execute()


def save_analysis_results(analysis_id: str, results: dict):
    sb = get_supabase()
    sb.table("analyses").update({
        "status": "complete",
        "slop_score": results["slop_score"],
        "scores": results["scores"],
        "verdict": results["verdict"],
        "receipts": results["receipts"],
        "metadata": results["metadata"],
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", analysis_id).execute()
