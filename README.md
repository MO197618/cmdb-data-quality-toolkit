# CMDB Data Quality Toolkit

A JavaScript-first toolkit with a Python equivalent for checking common Configuration Management Database (CMDB) data-quality issues. It runs locally against JSON exports or sample data and does not connect to a ServiceNow instance.

## Features

- Required-field checks for configuration items (CIs)
- Duplicate CI name and serial-number detection
- Invalid lifecycle/status value detection
- Stale discovery timestamp checks
- Relationship integrity checks for missing source/target CIs
- JSON report output and readable terminal summary
- Matching Python implementation

## Requirements

- Node.js 18+ for the JavaScript CLI
- Python 3.9+ for the Python CLI
- No third-party dependencies required

## Quick start: JavaScript

```bash
npm run check
```

Or supply your own JSON file:

```bash
node src/index.js path/to/your-cis.json --stale-days 90 --report reports/cmdb-report.json
```

## Python

```bash
python python/cmdb_quality.py data/sample-cis.json
```

With options:

```bash
python python/cmdb_quality.py data/sample-cis.json --stale-days 90 --report reports/cmdb-report.json
```

## Input format

```json
{
  "cis": [
    {
      "sys_id": "ci-001",
      "name": "app-server-01",
      "class": "cmdb_ci_server",
      "serial_number": "SN-001",
      "status": "Operational",
      "environment": "Production",
      "owner": "Platform Team",
      "last_discovered": "2026-09-01T12:00:00Z"
    }
  ],
  "relationships": [
    {
      "parent_sys_id": "ci-001",
      "child_sys_id": "ci-002",
      "type": "Depends on"
    }
  ]
}
```

`cis` is required. `relationships` is optional. The accepted status values are `Operational`, `In Service`, `On Order`, `In Stock`, `In Maintenance`, `Retired`, and `Absent`. Adjust these values to match your organization's approved CMDB lifecycle model.

## Checks and severity

- **ERROR**: missing required identifier/name, duplicate identifier/name/serial, invalid status, or relationship referencing a nonexistent CI.
- **WARNING**: missing class, environment, owner, or discovery timestamp; stale discovery timestamp.
- Duplicate serial numbers are ignored when blank.
- Staleness is measured against the current UTC time; use `--stale-days` to change the threshold.

This is a demonstration toolkit. Validate rules and thresholds against your organization's ServiceNow configuration, CMDB governance policy, and CSDM implementation before using it for production decisions.

## Project layout

```text
cmdb-data-quality-toolkit/
├── data/
│   └── sample-cis.json
├── src/
│   └── index.js
├── python/
│   └── cmdb_quality.py
├── test/
│   └── index.test.js
├── package.json
└── README.md
```

## Safety and privacy

Use synthetic or approved sanitized data. Do not commit credentials, production exports containing sensitive data, customer records, or internal configuration details to a public repository.
