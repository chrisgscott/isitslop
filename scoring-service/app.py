"""IsItSlop scoring service — standalone FastAPI app."""
import hmac
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from tools.pipeline import run_analysis
from tools.db import update_analysis_error

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok", "service": "isitslop-scoring"}


@app.post("/analyze")
async def analyze_webhook(request: Request):
    body = await request.json()

    expected = os.environ.get("SCORING_WEBHOOK_SECRET", "")
    token = (body.get("auth_token") or "").strip()
    if not expected or not hmac.compare_digest(token, expected):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    analysis_id = body.get("analysis_id")
    repo_owner = body.get("repo_owner")
    repo_name = body.get("repo_name")
    repo_branch = body.get("repo_branch")

    if not analysis_id or not repo_owner or not repo_name:
        return JSONResponse({"error": "Missing required fields"}, status_code=400)

    try:
        run_analysis(
            analysis_id=analysis_id,
            repo_owner=repo_owner,
            repo_name=repo_name,
            repo_branch=repo_branch,
        )
        return {"status": "complete", "analysis_id": analysis_id}
    except Exception as e:
        update_analysis_error(analysis_id, str(e))
        return {"status": "error", "error": str(e)}
