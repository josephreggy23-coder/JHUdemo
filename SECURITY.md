# Security policy

## Supported version

The current `main` branch is supported.

## Reporting a vulnerability

Please use GitHub's private vulnerability-reporting feature for this
repository. Do not include patient data, clinical scans, credentials, or other
sensitive information in a report.

## Privacy model

The application has no backend or upload endpoint. Medical files are read and
processed in the browser, and review drafts are stored only in browser-local
storage. Deployments should preserve the repository's content-security policy
and should not add analytics without clearly changing this privacy statement.
