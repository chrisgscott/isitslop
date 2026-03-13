DUPLICATE_PURPOSE_GROUPS = [
    ({"axios", "node-fetch", "got", "ky", "superagent", "request", "undici"}, "HTTP client"),
    ({"lodash", "underscore", "ramda"}, "utility library"),
    ({"moment", "dayjs", "date-fns", "luxon"}, "date library"),
    ({"express", "fastify", "koa", "hapi"}, "HTTP framework"),
    ({"jest", "mocha", "ava", "tap", "vitest"}, "test framework"),
    ({"winston", "pino", "bunyan", "log4js"}, "logging library"),
    ({"yup", "joi", "zod", "superstruct", "valibot"}, "validation library"),
    ({"styled-components", "emotion", "@emotion/react"}, "CSS-in-JS"),
]


def analyze_dependencies(
    package_json: dict | None,
    total_loc: int,
    has_lock_file: bool = True,
) -> list[dict]:
    if not package_json:
        return []

    findings = []
    deps = package_json.get("dependencies", {})
    dev_deps = package_json.get("devDependencies", {})
    all_dep_names = set(deps.keys()) | set(dev_deps.keys())

    dep_count = len(deps)
    if dep_count > 60:
        findings.append({
            "dimension": "dependencies",
            "severity": "high",
            "file": "package.json",
            "line": None,
            "issue": f"Excessive dependencies ({dep_count}) — possible dependency bloat",
            "evidence": f"{dep_count} production dependencies",
            "fix_prompt": f"This project has {dep_count} production dependencies. Audit them — are all of these actually used? Run `npx depcheck` to find unused packages.",
        })
    elif dep_count > 45:
        findings.append({
            "dimension": "dependencies",
            "severity": "medium",
            "file": "package.json",
            "line": None,
            "issue": f"High dependency count ({dep_count})",
            "evidence": f"{dep_count} production dependencies",
            "fix_prompt": f"Review your {dep_count} dependencies. Some may be unused or replaceable with built-in alternatives.",
        })

    if not has_lock_file and dep_count > 0:
        findings.append({
            "dimension": "dependencies",
            "severity": "high",
            "file": None,
            "line": None,
            "issue": "No lock file found (package-lock.json, yarn.lock, or pnpm-lock.yaml)",
            "evidence": "Missing lock file",
            "fix_prompt": "Add a lock file to ensure reproducible installs. Run `npm install`, `yarn install`, or `pnpm install` to generate one.",
        })

    for group, purpose in DUPLICATE_PURPOSE_GROUPS:
        found = all_dep_names & group
        if len(found) > 1:
            findings.append({
                "dimension": "dependencies",
                "severity": "medium",
                "file": "package.json",
                "line": None,
                "issue": f"Duplicate-purpose packages for {purpose}: {', '.join(sorted(found))}",
                "evidence": f"Multiple {purpose} libraries installed",
                "fix_prompt": f"You have multiple {purpose} libraries installed: {', '.join(sorted(found))}. Pick one and remove the others.",
            })

    return findings
