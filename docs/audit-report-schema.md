# Audit Report Schema

The `AuditReport` returned from `auditr.audits.get(id)` and
`auditr.audits.waitForCompletion(id)` is a flat object with camelCase
field names. Its public TypeScript definition is in
[`src/types.ts`](../src/types.ts).

The API sends a different shape: an `{ audit, findings }` envelope
with snake_case fields. The exported Zod schemas in
[`src/schema/index.ts`](../src/schema/index.ts) validate that raw API
response. The client validates first, then converts it into the SDK
result described below.

## Raw API response

Use `auditReportSchema` to validate raw response JSON, including raw
responses you have stored or relayed:

```ts
import { auditReportSchema } from '@auditrxyz/sdk/schema';

const parsed = auditReportSchema.parse({
  audit: {
    id: 'example-audit-id',
    status: 'completed',
    created_at: '2026-06-02T12:00:00.000Z',
  },
  findings: [],
});

console.log(parsed.audit.id);
```

The schema retains the envelope and raw field names. It does not
validate the flat object returned by `audits.get()` or
`waitForCompletion()`. Selected field mappings performed by the client:

| Raw API field | SDK result field |
| ------------- | ---------------- |
| `audit.id` | `auditId` |
| `audit.score` | `grade` |
| `audit.scan_profile` | `scanProfile` |
| `audit.created_at` | `createdAt` |
| `audit.severity_counts` | `severityCounts` |
| `audit.summary.management_summary` | `summary.managementSummary` |
| `audit.summary.grade_justification` (legacy fallback: `grade_rationale`) | `summary.gradeRationale` |
| `findings[].line_start` | `findings[].lineStart` |

## SDK result: top level

| Field            | Type                              | Description                                          |
| ---------------- | --------------------------------- | ---------------------------------------------------- |
| `auditId`        | `string`                          | UUID of the audit                                    |
| `status`         | `AuditStatus`                     | Lifecycle position                                   |
| `grade`          | `string` (optional)               | Letter grade once the audit completes                |
| `scanProfile`    | `AuditTier` (optional)            | `quick`, `standard`, or `web3` tier                   |
| `projectName`    | `string` (optional)               | Human readable target name                           |
| `createdAt`      | ISO 8601 string                   | When the audit was created                           |
| `completedAt`    | ISO 8601 string (optional)        | When the audit reached a terminal status             |
| `summary`        | object (optional)                | AI generated narrative summary; fields listed below  |
| `severityCounts` | `Partial<Record<Severity, number>>` (optional) | Counts of findings; individual severity keys may be absent |
| `findings`       | `Finding[]`                       | Structured findings                                  |

## `AuditStatus`

One of: `created`, `payment_pending`, `payment_confirmed`,
`analyzing`, `ai_processing`, `completed`, `failed`.

`completed` and `failed` are terminal. `waitForCompletion` polls
until one of these.

## `summary`

The summary and each of its fields are optional. `summary` is defined
inline on `AuditReport`; the package does not export a separate
`AuditSummary` type.

| Field                   | Type     | Notes                                                |
| ----------------------- | -------- | ---------------------------------------------------- |
| `managementSummary`     | `string` | Plain English overview of scope and findings        |
| `protocolOverview`      | `string` | What the target is and how it works                 |
| `methodology`           | `string` | How the analysis was performed                      |
| `threatModel`           | `string` | Primary threat vectors considered                   |
| `architectureReview`    | `string` | High level architecture observations                |
| `functionalityAnalysis` | `string` | What the application or contract does               |
| `securityAssessment`    | `string` | Strengths and weaknesses                            |
| `recommendations`       | `Recommendation[]` | Structured action items                    |
| `gradeRationale`        | `string` | Grade explanation from `grade_justification`, falling back to legacy `grade_rationale` |

### `Recommendation`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `title` | `string` | Required action title |
| `description` | `string` (optional) | Explanation of the recommendation |
| `severity` | `RecommendationSeverity` (optional) | `critical`, `high`, `medium`, `low`, `informational`, or `info` |
| `implementation` | `string` (optional) | Concrete implementation guidance |

Since v0.4.0, recommendations are returned as objects. The schema also
accepts legacy string recommendations and normalizes each string to
`{ title: string }`, so callers always receive structured entries.

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
for a completed report in the raw API response shape. Its legacy
`grade_rationale` field is converted to `summary.gradeRationale` in the
SDK result.
