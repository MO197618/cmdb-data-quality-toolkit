# CMDB Data Quality Toolkit

A JavaScript-first toolkit with Python support for identifying, validating, and reporting common Configuration Management Database (CMDB) data quality issues.

## Overview

The CMDB Data Quality Toolkit helps identify data quality problems that can affect CMDB reliability, accuracy, and completeness. It provides validation checks, clear issue summaries, and optional JSON reports to support CMDB data quality improvement.

## Features

- **Required-field validation:** Identifies missing CI identifiers and names.
- **Duplicate detection:** Detects duplicate configuration item identifiers, names, and serial numbers.
- **Status validation:** Checks CI statuses against an allowed list.
- **Discovery freshness checks:** Identifies missing, invalid, or outdated discovery timestamps.
- **Relationship integrity:** Flags relationships that reference nonexistent configuration items and self-referencing relationships.
- **Quality reporting:** Displays issue summaries and supports JSON report generation.
- **JavaScript implementation:** Runs on Node.js.
- **Python support:** Includes a companion implementation using Python's standard library.
- **Sample data and tests:** Includes sample CMDB records and automated test files.

## Project Structure

```text
cmdb-data-quality-toolkit/
├── data/
│   └── sample-cis.json
├── python/
│   └── cmdb_quality.py
├── src/
│   └── index.js
├── test/
│   └── index.test.js
├── package.json
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- Python 3.9 or later for the Python implementation

No third-party dependencies are required for the core implementations.

### Run the JavaScript Version

Run the built-in sample checks:

```bash
npm run check
```

Analyze a CMDB JSON file:

```bash
node src/index.js path/to/your-cis.json
```

Set the discovery-staleness threshold and generate a JSON report:

```bash
node src/index.js path/to/your-cis.json --stale-days 90 --report reports/cmdb-report.json
```

### Run the Python Version

Run the sample data check:

```bash
python python/cmdb_quality.py
```

Analyze a custom file:

```bash
python python/cmdb_quality.py path/to/your-cis.json
```

Generate a report with a custom staleness threshold:

```bash
python python/cmdb_quality.py path/to/your-cis.json --stale-days 90 --report reports/cmdb-report.json
```

### Run Tests

Run the automated JavaScript tests:

```bash
npm test
```

## Technologies

- JavaScript (ES modules)
- Node.js
- Python
- JSON
- Node.js built-in test runner

## Planned Enhancements

- Configurable validation rules and CI-class-specific requirements
- Additional relationship and dependency analysis
- Status mappings aligned with organizational policies
- Expanded remediation recommendations and quality trend reporting
- Optional ServiceNow integrations for authorized environments

## Disclaimer

This is a development and demonstration project. Validation rules should be reviewed and adjusted to match your ServiceNow configuration, CMDB governance policies, and Common Service Data Model (CSDM) requirements before production use. Test results should be verified before relying on them for operational decisions.

Use synthetic or sanitized data for demonstrations. Do not commit credentials, confidential information, or sensitive production CMDB data to this repository.
