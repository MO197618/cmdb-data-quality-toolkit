CMDB Data Quality Toolkit
A JavaScript-first toolkit for auditing ServiceNow CMDB data quality, with Python support.

Features
Validate configuration items (CIs)
Identify duplicate or missing CI identifiers
Check relationships and data quality issues
Detect invalid CI statuses and stale discovery timestamps
Generate JSON data-quality reports
Technologies
JavaScript (Node.js)
Python
JSON
Quick Start
Run the JavaScript checks:

npm run check
Run the automated tests:

npm test
Run the Python checker:

python python/cmdb_quality.py data/sample-cis.json
Note: This toolkit audits sample or exported JSON data locally; it does not connect directly to a ServiceNow instance.