import os
import json
from datetime import datetime, timezone
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def update_analysis_status(analysis_id: str, status: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE analyses SET status = %s WHERE id = %s",
                (status, analysis_id),
            )


def update_analysis_error(analysis_id: str, error_message: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE analyses SET status = 'error', error_message = %s WHERE id = %s",
                (error_message, analysis_id),
            )


def save_analysis_results(analysis_id: str, results: dict):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE analyses SET
                    status = 'complete',
                    slop_score = %s,
                    scores = %s,
                    verdict = %s,
                    receipts = %s,
                    metadata = %s,
                    analyzed_at = %s
                WHERE id = %s""",
                (
                    results["slop_score"],
                    json.dumps(results["scores"]),
                    results["verdict"],
                    json.dumps(results["receipts"]),
                    json.dumps(results["metadata"]),
                    datetime.now(timezone.utc).isoformat(),
                    analysis_id,
                ),
            )
