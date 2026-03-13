import os
import json
from openai import OpenAI

DEFAULT_MODEL = "gpt-4.1-mini"

SYSTEM_PROMPT = """You are the voice of IsItSlop — a vibe code gut check tool. You write brutally honest, specific, and funny verdicts about code quality. You're not mean, but you're not nice either. You're the friend who tells you your fly is down.

Your audience: developers who know they vibe coded something with AI and want to know how bad it is. They can take it.

Rules:
- Be specific. Reference actual files, actual counts, actual problems.
- Be funny. Not try-hard funny. Deadpan, observational funny.
- Be actionable. Every critique should be fixable.
- Keep the overall verdict to 2-4 sentences max.
- Write dimension commentary as 1-2 punchy sentences each.
- Don't be generic. "Code could be improved" is worthless. "47 console.logs in production code" is useful.
- The tone is "your AI did you dirty — here are the receipts."
- Don't congratulate them on anything unless the score is genuinely good (A or B).
"""

USER_PROMPT_TEMPLATE = """Write a verdict for this repo analysis:

**Repo:** {repo_name}
**Slop Score:** {slop_score}/100 (higher = more slop)
**Files:** {total_files} | **LOC:** {total_loc}

**Dimension Grades:**
{dimension_grades}

**Top Findings:**
{top_findings}

Write:
1. An overall verdict (2-4 sentences, punchy)
2. One-liner commentary for each of the 6 dimensions

Format as plain text. Start with the verdict, then list each dimension on its own line as "**Dimension Name:** commentary"."""


def build_verdict_prompt(
    repo_name: str,
    slop_score: int,
    scores: dict,
    findings: list[dict],
    metadata: dict,
) -> str:
    dimension_grades = "\n".join([
        f"- {dim}: {data['grade']} ({data['score']}/100, {data['findings_count']} issues)"
        for dim, data in scores.items()
    ])

    # Top 10 most severe findings
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_findings = sorted(findings, key=lambda f: severity_order.get(f.get("severity", "low"), 4))
    top = sorted_findings[:10]

    top_findings = "\n".join([
        f"- [{f.get('severity', 'medium').upper()}] {f['issue']}" + (f" ({f['file']})" if f.get('file') else "")
        for f in top
    ])

    return USER_PROMPT_TEMPLATE.format(
        repo_name=repo_name,
        slop_score=slop_score,
        total_files=metadata.get("total_files", "?"),
        total_loc=metadata.get("total_loc", "?"),
        dimension_grades=dimension_grades,
        top_findings=top_findings or "No significant findings.",
    )


def parse_verdict_response(response_text: str) -> str:
    return response_text.strip()


def generate_verdict(
    repo_name: str,
    slop_score: int,
    scores: dict,
    findings: list[dict],
    metadata: dict,
    model: str | None = None,
) -> str:
    """Call OpenAI to generate the snarky verdict."""
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    prompt = build_verdict_prompt(repo_name, slop_score, scores, findings, metadata)

    response = client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.9,
        max_tokens=1000,
    )

    return parse_verdict_response(response.choices[0].message.content)
