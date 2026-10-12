#!/usr/bin/env python3
"""Python companion for the CMDB Data Quality Toolkit; standard library only."""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ALLOWED_STATUSES = {
    "Operational", "In Service", "On Order", "In Stock",
    "In Maintenance", "Retired", "Absent"
}


def parse_date(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def audit_cmdb(data, stale_days=90, now=None):
    issues = []

    def add(severity, code, message, ci=None):
        item = {"severity": severity, "code": code, "message": message}
        if ci is not None:
            item["ci"] = ci
        issues.append(item)

    if not isinstance(data.get("cis"), list):
        add("ERROR", "INVALID_INPUT", 'Input must contain a "cis" array.')
        return make_result(issues)

    cis = data["cis"]
    relationships = data.get("relationships", [])
    if not isinstance(relationships, list):
        relationships = []
        add("WARNING", "INVALID_RELATIONSHIPS", '"relationships" must be an array; skipped.')

    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    by_id, names, serials = {}, {}, {}

    for index, ci in enumerate(cis, start=1):
        if not isinstance(ci, dict):
            add("ERROR", "INVALID_CI", f"CI at row {index} is not an object.")
            continue
        label = ci.get("name") or ci.get("sys_id") or f"row-{index}"
        sys_id = str(ci.get("sys_id") or "").strip()
        name = str(ci.get("name") or "").strip()

        if not sys_id:
            add("ERROR", "MISSING_SYS_ID", "CI is missing sys_id.", label)
        elif sys_id in by_id:
            add("ERROR", "DUPLICATE_SYS_ID", f'Duplicate sys_id "{sys_id}".', label)
        else:
            by_id[sys_id] = ci

        if not name:
            add("ERROR", "MISSING_NAME", "CI is missing name.", label)
        else:
            key = name.lower()
            if key in names:
                add("ERROR", "DUPLICATE_NAME", f'Name "{name}" also appears on {names[key]}.', label)
            else:
                names[key] = label

        serial = str(ci.get("serial_number") or "").strip()
        if serial:
            key = serial.lower()
            if key in serials:
                add("ERROR", "DUPLICATE_SERIAL", f'Serial "{serial}" also appears on {serials[key]}.', label)
            else:
                serials[key] = label

        for field, code, message in (
            ("class", "MISSING_CLASS", "CI is missing class."),
            ("environment", "MISSING_ENVIRONMENT", "CI is missing environment."),
            ("owner", "MISSING_OWNER", "CI is missing owner/support group."),
        ):
            if not str(ci.get(field) or "").strip():
                add("WARNING", code, message, label)

        status = str(ci.get("status") or "").strip()
        if not status:
            add("WARNING", "MISSING_STATUS", "CI is missing status.", label)
        elif status not in ALLOWED_STATUSES:
            add("ERROR", "INVALID_STATUS", f'Status "{status}" is not in the configured allowed-status list.', label)

        discovered_raw = str(ci.get("last_discovered") or "").strip()
        if not discovered_raw:
            add("WARNING", "MISSING_DISCOVERY_DATE", "CI has no last_discovered timestamp.", label)
        else:
            discovered = parse_date(discovered_raw)
            if discovered is None:
                add("WARNING", "INVALID_DISCOVERY_DATE", f'Cannot parse last_discovered value "{discovered_raw}".', label)
            else:
                age_days = (now - discovered).total_seconds() / 86400
                if age_days > stale_days:
                    add("WARNING", "STALE_DISCOVERY", f"Last discovered more than {stale_days} days ago.", label)
                elif age_days < -1:
                    add("WARNING", "FUTURE_DISCOVERY_DATE", "last_discovered is more than one day in the future.", label)

    for index, rel in enumerate(relationships, start=1):
        if not isinstance(rel, dict):
            add("ERROR", "INVALID_RELATIONSHIP", f"Relationship at row {index} is not an object.")
            continue
        parent = str(rel.get("parent_sys_id") or "")
        child = str(rel.get("child_sys_id") or "")
        if parent not in by_id:
            add("ERROR", "ORPHAN_RELATIONSHIP_PARENT", f'Relationship {index} references missing parent "{parent}".')
        if child not in by_id:
            add("ERROR", "ORPHAN_RELATIONSHIP_CHILD", f'Relationship {index} references missing child "{child}".')
        if parent and child and parent == child:
            add("WARNING", "SELF_RELATIONSHIP", f"Relationship {index} links a CI to itself.")
        if not str(rel.get("type") or "").strip():
            add("WARNING", "MISSING_RELATIONSHIP_TYPE", f"Relationship {index} is missing type.")

    return make_result(issues)


def make_result(issues):
    return {
        "summary": {
            "total": len(issues),
            "errors": sum(1 for x in issues if x["severity"] == "ERROR"),
            "warnings": sum(1 for x in issues if x["severity"] == "WARNING"),
        },
        "issues": issues,
    }


def main():
    parser = argparse.ArgumentParser(description="Audit a CMDB JSON export for common data-quality issues.")
    parser.add_argument("file", nargs="?", default="data/sample-cis.json", help="Input JSON file")
    parser.add_argument("--stale-days", type=int, default=90, help="Discovery age in days before warning (default: 90)")
    parser.add_argument("--report", help="Write JSON report to this path")
    args = parser.parse_args()

    try:
        data = json.loads(Path(args.file).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Could not read/parse {args.file}: {exc}", file=sys.stderr)
        return 2

    result = audit_cmdb(data, stale_days=args.stale_days)
    print(f"\nCMDB Data Quality Report: {Path(args.file).resolve()}")
    print("Total issues: {total} | Errors: {errors} | Warnings: {warnings}".format(**result["summary"]))
    if not result["issues"]:
        print("No issues found.")
    for item in result["issues"]:
        label = f' ({item["ci"]})' if item.get("ci") else ""
        print(f'[{item["severity"]}] {item["code"]}{label}: {item["message"]}')

    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(f"\nJSON report written to {report_path.resolve()}")
    return 1 if result["summary"]["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
