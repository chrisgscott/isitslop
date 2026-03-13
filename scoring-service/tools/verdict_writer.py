import os
import json
from openai import OpenAI

DEFAULT_MODEL = "gpt-4.1-mini"

SYSTEM_PROMPT = """You are a teacher writing report card comments for the "Department of Vibe Code Assessment." You've been teaching too long. You've seen too many students let their AI do their homework. You're not angry — you're disappointed. And a little tired.

Your persona: a jaded but caring teacher who's graded thousands of these. You use school metaphors naturally — "showing up to class," "did the homework," "see me after class," "parent-teacher conference," etc. You've got dry wit and zero patience for laziness, but you genuinely light up when a student actually tries.

Your audience: developers who know they vibe coded something with AI and want to know how bad it is. They can take it.

Rules:
- Be specific. Reference actual files, actual counts, actual problems. Vague feedback is lazy teaching.
- Be funny. Deadpan, world-weary teacher funny. Not try-hard. Think resigned sighs, not shouting.
- Keep the overall verdict to 2-4 sentences max. You don't have time for essays — you have 30 more of these to grade tonight.
- Write dimension commentary as 1-2 punchy sentences each.
- Don't be generic. "Needs improvement" is what bad teachers write. "47 console.logs — were you debugging in production or journaling?" is what you write.
- For genuinely good work (A or B), give grudging respect. "Well. Someone actually read the syllabus." You're surprised but not effusive.
- For bad work, channel the exhaustion. You've seen this same mistake 400 times. You're not mad, you're just... tired.
- Never break character. You are a teacher writing on a report card. Not a code review tool.
"""

USER_PROMPT_TEMPLATE = """Write report card comments for this student:

**Student:** {repo_name}
**Overall Grade:** {overall_grade}/100 (higher = better, like a real grade)
**Files:** {total_files} | **LOC:** {total_loc}

**Subject Grades:**
{dimension_grades}

**Notable Incidents:**
{top_findings}

Write:
1. "Teacher's Comments" — your overall assessment (2-4 sentences). Write as if handwriting this on a physical report card. Be specific about what you saw.
2. A one-liner comment for each of the 6 subjects/dimensions.

Format as plain text. Do NOT include a "Teacher's Comments:" prefix — just start writing the assessment directly. Then list each dimension on its own line as "**Dimension Name:** commentary". Use the exact display names given above (Error Handling, Code Structure, Test Coverage, Security, Dependencies, Documentation) — NOT snake_case database column names."""


DIMENSION_LABELS = {
    "error_handling": "Error Handling",
    "code_structure": "Code Structure",
    "test_coverage": "Test Coverage",
    "security": "Security",
    "dependencies": "Dependencies",
    "documentation": "Documentation",
}


def build_verdict_prompt(
    repo_name: str,
    slop_score: int,
    scores: dict,
    findings: list[dict],
    metadata: dict,
) -> str:
    dimension_grades = "\n".join([
        f"- {DIMENSION_LABELS.get(dim, dim)}: {data['grade']} ({data['score']}/100, {data['findings_count']} issues)"
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
        overall_grade=100 - slop_score,
        total_files=metadata.get("total_files", "?"),
        total_loc=metadata.get("total_loc", "?"),
        dimension_grades=dimension_grades,
        top_findings=top_findings or "No significant findings.",
    )


def parse_verdict_response(response_text: str) -> str:
    text = response_text.strip()
    # Strip redundant prefix if LLM includes it
    for prefix in ("Teacher's Comments:", "Teacher's Comments:\n", "Teacher's Comments:  \n"):
        if text.startswith(prefix):
            text = text[len(prefix):].strip()
    return text


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
