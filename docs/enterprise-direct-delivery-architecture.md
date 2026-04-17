# Enterprise Direct Delivery Architecture

Internal technical note for discussion of an enterprise due diligence delivery model with customer-controlled storage and minimal retention.

## Objective

Offer large customers an enterprise workflow where due diligences are:

- generated in our EU infrastructure
- delivered directly to customer-controlled storage
- not retained in our normal storage layer
- accompanied by an audit trail covering generation, delivery, deletion, and access events

This feature should strengthen the enterprise privacy and procurement story while also reducing our storage footprint.

## Core Principle

We should avoid claiming that we "cannot see" the due diligence, because our systems necessarily process the report during generation.

The defensible enterprise claim is:

- we generate the report in our EU environment
- we deliver it directly to customer-controlled infrastructure
- we do not persist the report after successful delivery, except for tightly controlled transient processing needs
- we provide an audit trail showing delivery, cleanup, and access events

## Proposed End-to-End Flow

1. Customer orders a due diligence through our portal or API.
2. Our job orchestrator creates a processing job in the Germany/EU environment.
3. The report generator builds the due diligence in an isolated worker.
4. The generated output is streamed or uploaded directly to the customer's storage target.
5. Temporary artifacts are deleted immediately after successful delivery.
6. An audit record is assembled from immutable system events.
7. The audit trail document is uploaded to the customer portal.

## Architecture Components

### 1. Job Orchestrator

Responsible for:

- receiving the order
- assigning a job ID
- enforcing that processing happens in the Germany/EU environment
- tracking lifecycle state
- coordinating delivery, deletion, and audit generation

Suggested job states:

- `queued`
- `generating`
- `uploading`
- `uploaded`
- `cleanup_in_progress`
- `cleanup_verified`
- `audit_generated`
- `completed`
- `failed`

### 2. Report Generator

Responsible for:

- producing the due diligence document
- running in an isolated ephemeral worker or container
- using service identities only
- avoiding report content in logs

Design goals:

- one isolated job per worker where possible
- no persistent local storage
- no interactive human access
- no report content written to application logs

### 3. Delivery Adapter Layer

Responsible for:

- abstracting customer-specific storage destinations
- uploading the generated artifact
- recording upload metadata

Supported enterprise delivery targets should include:

- `S3` or S3-compatible object storage
- `Azure Blob Storage`
- `Google Cloud Storage`
- `SFTP`
- customer HTTPS endpoint or webhook

Preferred options for security and operational simplicity:

- one-time pre-signed upload URLs issued by the customer
- write-only scoped customer storage credentials

### 4. Cleanup and Deletion Verifier

Responsible for:

- deleting temporary files or temporary objects
- verifying that no report artifact remains in our normal persistence path
- recording cleanup events

This component should verify deletion of:

- temp files
- temp object storage entries
- transient queue payloads, if any
- cached report copies, if any

### 5. Audit Service

Responsible for:

- collecting immutable lifecycle events
- generating a human-readable audit trail document
- generating a machine-readable audit record if needed

The audit service should not depend on mutable application state alone. It should source events from append-only logs or immutable event records wherever possible.

### 6. Customer Portal Uploader

Responsible for:

- attaching the audit trail to the customer order or account workspace
- making the audit artifact visible for contract, billing, and compliance review

## Recommended Delivery Pattern

The preferred implementation is `streaming direct delivery`.

This means:

- the report is generated in our EU worker
- the worker streams the result directly to the customer destination
- our systems avoid storing a normal persistent copy

If streaming is not technically practical for all formats or destinations, the fallback should be:

- store the report only in encrypted temporary storage
- set a very short TTL
- delete immediately after confirmed upload

## Customer Storage Integration Options

### Option A: Pre-Signed Upload URL

Customer provides a one-time upload URL for each report.

Advantages:

- no persistent customer credentials stored by us
- clear least-privilege model
- easier privacy positioning

Disadvantages:

- requires tighter orchestration with the customer system
- may complicate retries if the URL expires quickly

### Option B: Scoped Write-Only Bucket Credentials

Customer gives us restricted credentials to upload into a defined storage path.

Advantages:

- easier retry behavior
- simpler for recurring bulk workflows

Disadvantages:

- we must manage customer credentials securely
- larger operational responsibility

### Option C: SFTP

Simple and familiar for many enterprises.

Advantages:

- widely accepted by corporate IT
- easy to explain and integrate

Disadvantages:

- weaker modern cloud ergonomics
- more operational overhead
- slower and less flexible than object storage

### Option D: Customer API Endpoint

Customer exposes an endpoint for report ingestion.

Advantages:

- good fit for customer workflow automation
- supports richer metadata exchange

Disadvantages:

- greater integration variability
- higher support burden

## Access Control Model

To support a strong audit story, the system should be built around the principle that human access is not required during normal report generation.

Recommended controls:

- service accounts only for job execution
- no report content in logs
- no shared operational inbox containing report bodies
- restricted production access
- break-glass access only through approval workflow
- separate logging for break-glass events

The audit trail can then credibly state:

- whether any human access was detected during the processing window
- which system identities processed the report
- whether any break-glass or administrative event occurred

## Cleanup and Memory Handling

We should be precise about what we can and cannot guarantee.

We can reliably implement:

- deletion of temporary files
- deletion of temporary objects
- termination of the isolated worker after job completion
- minimization of in-memory retention time
- elimination of report content from logs

We should avoid overclaiming that application RAM is cryptographically wiped.

The correct technical position is:

- reports are processed in isolated ephemeral workers
- temporary artifacts are deleted immediately after delivery
- the worker is terminated after processing
- persistent retention is avoided

## Audit Trail Design

Each job should produce an audit package with both machine-readable and human-readable forms.

### Machine-readable audit record

Recommended format:

- signed JSON document

Suggested fields:

- `job_id`
- `customer_id`
- `order_id`
- `processing_region`
- `generation_started_at`
- `generation_completed_at`
- `delivery_started_at`
- `delivery_completed_at`
- `delivery_target_type`
- `delivery_target_reference`
- `cleanup_started_at`
- `cleanup_completed_at`
- `worker_identity`
- `human_access_detected`
- `human_access_events`
- `artifact_sha256`
- `audit_generated_at`

### Human-readable audit document

Recommended format:

- PDF summary attached to the customer portal

Suggested sections:

- Customer reference
- Report or order ID
- Processing location: Germany, EU
- Delivery destination
- Delivery timestamp
- File checksum
- Temporary artifact deletion confirmation
- Access summary
- System identities involved
- Retention statement

Including a `SHA-256` hash of the delivered artifact is recommended, because the customer can later confirm that the received report matches the audit record.

## Suggested Audit Events

At minimum, record these events:

- `job_created`
- `generation_started`
- `generation_completed`
- `upload_started`
- `upload_completed`
- `temp_artifact_deleted`
- `cleanup_verified`
- `worker_terminated`
- `audit_generated`
- `audit_uploaded_to_portal`

If supported by the infrastructure, also record:

- `human_access_attempted`
- `human_access_granted`
- `admin_session_started`
- `admin_session_ended`

## Upload of the Audit Trail to the Customer Portal

Once delivery and cleanup verification succeed:

1. Generate the audit package.
2. Store the machine-readable audit record in our internal compliance store.
3. Upload the human-readable audit document to the customer portal.
4. Link the audit document to the order, billing, or contract record.

The customer portal should show at least:

- report identifier
- completion timestamp
- processing region
- delivery confirmation
- cleanup confirmation
- audit document download

## Retention Strategy

Recommended enterprise retention position:

- report content: no normal retention after successful delivery
- transient retry copy: only if strictly required, encrypted, and short-lived
- operational metadata: retained for support and billing
- audit records: retained according to contractual and compliance needs

This separates `report content retention` from `audit and billing retention`.

## Failure and Retry Strategy

The system needs a controlled retry design for failed deliveries.

Recommended approach:

- if delivery fails before completion, keep only an encrypted transient retry artifact
- assign a short TTL
- retry automatically within a limited window
- delete the transient artifact when upload succeeds or retry window expires

This should be contractually described as a narrowly scoped operational exception, not standard retention.

## Recommended Customer-Facing Positioning

Good phrasing:

- direct delivery to customer-controlled storage
- no normal report retention after successful delivery
- EU-based report generation
- audit trail covering delivery and cleanup
- optional customer-managed encryption in a future phase

Phrasing to avoid:

- we never see the report
- zero data access under all circumstances
- guaranteed RAM wipe

## Suggested Implementation Phases

### Phase 1: Bring Your Own Storage

Deliver:

- customer storage configuration
- direct upload to customer destination
- immediate cleanup of temporary artifacts
- basic audit trail in portal

Best for:

- validating market demand
- reducing our storage footprint
- supporting procurement and privacy discussions

### Phase 2: Stronger Auditability

Deliver:

- immutable event-backed audit service
- explicit human access monitoring
- signed audit package
- richer customer portal evidence

### Phase 3: Customer-Managed Encryption

Deliver:

- public key encryption or customer KMS integration
- stronger posture for customers with elevated privacy requirements

## Open Questions for Discussion

1. Which delivery targets should be supported first: S3, pre-signed URLs, SFTP, or API endpoints?
2. Should transient retry storage be allowed by default, or only as an opt-in enterprise operational safeguard?
3. What is the minimum audit evidence needed to make the feature commercially credible?
4. Should customers receive the audit package as PDF only, or also as signed JSON?
5. Should this feature be positioned as an enterprise add-on, a premium plan, or a default option for large accounts?

## Working Recommendation

The cleanest first implementation is:

- generate the due diligence in Germany/EU
- upload directly to customer-controlled object storage using pre-signed URLs or scoped write-only credentials
- avoid normal report retention on our side
- delete temporary artifacts immediately after successful upload
- generate an audit document with timestamps, checksum, delivery confirmation, cleanup confirmation, and access summary
- upload that audit document to the customer portal

This is technically realistic, commercially attractive, and defensible in enterprise privacy and compliance conversations.
