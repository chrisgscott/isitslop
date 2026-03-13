import modal
import os
import sys

# Add /root to path for Modal container (tools are at /root/tools)
if "/root" not in sys.path:
    sys.path.insert(0, "/root")

app = modal.App("isitslop-scoring")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements("requirements.txt")
    .add_local_dir("tools", remote_path="/root/tools")
)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("isitslop-secrets")],
    timeout=600,
    scaledown_window=60,
)
@modal.fastapi_endpoint(method="GET")
def health():
    return {"status": "ok", "service": "isitslop-scoring"}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("isitslop-secrets")],
    timeout=600,
    scaledown_window=60,
)
@modal.fastapi_endpoint(method="POST")
def analyze_webhook(request: dict):
    """Webhook endpoint to trigger repo analysis."""
    from tools.pipeline import run_analysis

    analysis_id = request.get("analysis_id")
    repo_owner = request.get("repo_owner")
    repo_name = request.get("repo_name")
    repo_branch = request.get("repo_branch")

    if not analysis_id or not repo_owner or not repo_name:
        return {"error": "Missing required fields"}

    try:
        run_analysis(
            analysis_id=analysis_id,
            repo_owner=repo_owner,
            repo_name=repo_name,
            repo_branch=repo_branch,
        )
        return {"status": "complete", "analysis_id": analysis_id}
    except Exception as e:
        from tools.db import update_analysis_error
        update_analysis_error(analysis_id, str(e))
        return {"status": "error", "error": str(e)}


@app.local_entrypoint()
def main():
    print("IsItSlop scoring service ready.")
    print("Run with: modal serve modal_app.py")
