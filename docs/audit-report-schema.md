# Audit Report Schema

The `AuditReport` returned from `auditr.audits.get(id)` and
`auditr.audits.waitForCompletion(id)` has the following shape. The
authoritative version is the Zod schema in
[`src/schema/index.ts`](../src/schema/index.ts); this document is the
prose summary.

## Top level

| Field            | Type                              | Description                                          |
| ---------------- | --------------------------------- | ---------------------------------------------------- |
| `auditId`        | `string`                          | UUID of the audit                                    |
| `status`         | `AuditStatus`                     | Lifecycle position                                   |
| `grade`          | `string` (optional)               | Letter grade once the audit completes                |
| `projectName`    | `string` (optional)               | Human readable target name                           |
| `createdAt`      | ISO 8601 string                   | When the audit was created                           |
| `completedAt`    | ISO 8601 string (optional)        | When the audit reached a terminal status             |
| `summary`        | `AuditSummary` (optional)         | AI generated narrative summary                       |
| `severityCounts` | `Record<Severity, number>`        | Counts of findings by severity                       |
| `findings`       | `Finding[]`                       | Structured findings                                  |

## `AuditStatus`

One of: `created`, `payment_pending`, `payment_confirmed`,
`analyzing`, `ai_processing`, `completed`, `failed`.

`completed` and `failed` are terminal. `waitForCompletion` polls
until one of these.

## `AuditSummary`

| Field                   | Type     | Notes                                                |
| ----------------------- | -------- | ---------------------------------------------------- |
| `managementSummary`     | `string` | Plain English overview of scope and findings        |
| `protocolOverview`      | `string` | What the target is and how it works                 |
| `methodology`           | `string` | How the analysis was performed                      |
| `threatModel`           | `string` | Primary threat vectors considered                   |
| `architectureReview`    | `string` | High level architecture observations                |
| `functionalityAnalysis` | `string` | What the application or contract does               |
| `securityAssessment`    | `string` | Strengths and weaknesses                            |
| `recommendations`       | `string[]` | Ordered action items                              |
| `gradeRationale`        | `string` | Why the audit received its grade                    |

## `Finding`

| Field            | Type                              | Description                                          |
| ---------------- | --------------------------------- | ---------------------------------------------------- |
| `severity`       | `Severity`                        | `critical`, `high`, `medium`, `low`, `info`          |
| `title`          | `string`                          | One line description                                 |
| `category`       | `string` (optional)               | Classifier (e.g. `site:headers`, `contract:reentrancy`) |
| `description`    | `string` (optional)               | Detailed explanation                                 |
| `recommendation` | `string` (optional)               | How to fix                                           |
| `file`           | `string` (optional)               | Source URL or path                                   |
| `lineStart`      | `number` (optional)               | First line of the matched region                     |
| `lineEnd`        | `number` (optional)               | Last line of the matched region                      |
| `references`     | `string[]` (optional)             | External references (CWE, OWASP, etc.)               |

## Severity ordering

`critical > high > medium > low > info`. The grade reflects the
worst severity present plus the count of mediums and highs. The
exact formula is implementation defined; the rationale field is
authoritative for any given report.

## Example

See [`tests/fixtures/sample-report.json`](../tests/fixtures/sample-report.json)
for a minimal completed report.
