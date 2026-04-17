# ValuePilot — DynamoDB Log Schema ERD Specification
**Version:** 1.0  
**Date:** 2026-04-16  
**Prepared for:** DBA / Infrastructure Team  
**System:** ValuePilot Platform (7-product SaaS + ML Anomaly Detection)

---

## Overview

This document defines the complete DynamoDB table schema for all platform log streams. The design follows **Single-Table Design (STD)** within each domain and uses composite sort keys for range queries and time-series access. All timestamps are stored as ISO 8601 UTC strings and as Unix epoch milliseconds for numeric range operations.

---

## Table Inventory

| Table Name | Domain | Estimated RCU | Estimated WCU | TTL |
|---|---|---|---|---|
| `vp-users-log` | Auth & Identity | 10 | 5 | 365 days |
| `vp-transactions-log` | Financial / ML | 50 | 50 | 90 days |
| `vp-subscriptions-log` | Detected Subscriptions | 20 | 10 | 180 days |
| `vp-plaid-log` | Plaid Bank Connections | 10 | 5 | 365 days |
| `vp-stripe-log` | Stripe Billing Events | 20 | 20 | 365 days |
| `vp-enterprise-log` | Orders / Invoices | 10 | 10 | 730 days |
| `vp-partner-log` | Partner Portal / Seats | 10 | 10 | 730 days |
| `vp-email-intel-log` | Email Connections & Scans | 20 | 20 | 90 days |
| `vp-signals-log` | Product Signal Detections | 30 | 30 | 90 days |
| `vp-alerts-log` | Lambda Renewal Alerts | 20 | 10 | 90 days |
| `vp-ml-inference-log` | ML Anomaly Detection | 30 | 30 | 90 days |

---

## Table 1: `vp-users-log`
**Domain:** Authentication, User Management, Session Events

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `USER#{userId}` |
| `SK` | String | Sort Key | `EVENT#{eventType}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-email-time` | `email` | `timestamp_ms` | Look up all events by email address |
| `GSI2-eventType-time` | `eventType` | `timestamp_ms` | Query all LOGIN, LOGOUT, ROLE_CHANGE events across all users |

### Attributes
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `USER#{userId}` |
| `SK` | S | YES | `EVENT#{eventType}#{timestamp_ms}` |
| `userId` | S | YES | UUID |
| `email` | S | YES | User email address |
| `name` | S | YES | Display name |
| `role` | S | YES | `admin` \| `analyst` \| `viewer` |
| `eventType` | S | YES | `CREATED` \| `LOGIN` \| `LOGOUT` \| `ROLE_CHANGED` \| `PASSWORD_RESET` \| `DEACTIVATED` |
| `previousRole` | S | NO | Previous role value on ROLE_CHANGED events |
| `ipAddress` | S | NO | Client IP at time of event |
| `userAgent` | S | NO | Browser/client user agent |
| `timestamp` | S | YES | ISO 8601 UTC (e.g. `2026-04-16T12:00:00Z`) |
| `timestamp_ms` | N | YES | Unix epoch milliseconds — used for range queries and TTL base |
| `ttl` | N | YES | Unix epoch seconds — DynamoDB TTL attribute (365 days from event) |

### Entity Relationship
```
USER (1) ──────── (*) USER_EVENT
```

### Access Patterns
| Pattern | Key Used |
|---|---|
| All events for a user | `PK = USER#{userId}` |
| All events for a user in a date range | `PK = USER#{userId}`, `SK BETWEEN EVENT##{from_ms} AND EVENT##{to_ms}` |
| All login events across system | `GSI2: eventType = LOGIN` |
| All events for an email address | `GSI1: email = {email}` |

---

## Table 2: `vp-transactions-log`
**Domain:** Financial Transactions, Plaid-synced Data

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `ACCOUNT#{accountId}` |
| `SK` | String | Sort Key | `TXN#{timestamp_ms}#{transactionId}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-txnId` | `transactionId` | `timestamp_ms` | Direct lookup by transaction ID |
| `GSI2-status-time` | `status` | `timestamp_ms` | Query failed/pending/reversed transactions |
| `GSI3-userId-time` | `userId` | `timestamp_ms` | All transactions for a user across accounts |

### Attributes
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `ACCOUNT#{accountId}` |
| `SK` | S | YES | `TXN#{timestamp_ms}#{transactionId}` |
| `transactionId` | S | YES | UUID |
| `accountId` | S | YES | Bank account ID (from Plaid) |
| `userId` | S | YES | Owner user ID |
| `amount` | N | YES | Transaction amount (positive = debit) |
| `currency` | S | YES | ISO 4217, default `USD` |
| `transactionType` | S | YES | `debit` \| `credit` \| `transfer` \| `withdrawal` |
| `merchantCategory` | S | NO | MCC category label |
| `merchantName` | S | NO | Cleaned merchant name |
| `location` | S | NO | City, State or coordinates string |
| `status` | S | YES | `completed` \| `pending` \| `failed` \| `reversed` |
| `ipAddress` | S | NO | IP at time of transaction initiation |
| `deviceId` | S | NO | Device fingerprint |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 90 days from event |

### Entity Relationship
```
USER (1) ──────── (*) ACCOUNT
ACCOUNT (1) ──────── (*) TRANSACTION
```

---

## Table 3: `vp-subscriptions-log`
**Domain:** Detected Subscription Lifecycle Events

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `USER#{userId}` |
| `SK` | String | Sort Key | `SUB#{subscriptionId}#{eventType}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-merchant-time` | `merchant` | `timestamp_ms` | All detections for a merchant across all users |
| `GSI2-status-time` | `status` | `timestamp_ms` | All at_risk or cancelled subscriptions |
| `GSI3-subId` | `subscriptionId` | `timestamp_ms` | Full lifecycle of one subscription |

### Attributes
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `USER#{userId}` |
| `SK` | S | YES | `SUB#{subscriptionId}#{eventType}#{timestamp_ms}` |
| `subscriptionId` | S | YES | Computed key (`{merchant}_{accountId}`) |
| `userId` | S | YES | Owner user ID |
| `eventType` | S | YES | `DETECTED` \| `RENEWED` \| `STATUS_CHANGED` \| `CANCELLED` \| `AMOUNT_CHANGED` |
| `merchant` | S | YES | Cleaned merchant name |
| `category` | S | YES | Subscription category label |
| `frequency` | S | YES | `monthly` \| `quarterly` \| `annual` \| `weekly` \| `irregular` |
| `frequencyLabel` | S | YES | Human-readable frequency |
| `amountPerOccurrence` | N | YES | Per-cycle charge in USD |
| `annualCost` | N | YES | Annualized cost in USD |
| `confidence` | N | YES | Detection confidence 0–1 |
| `occurrences` | N | YES | Number of matching transactions |
| `lastCharged` | S | YES | Date string `YYYY-MM-DD` |
| `nextExpected` | S | NO | Predicted next charge date `YYYY-MM-DD` |
| `status` | S | YES | `active` \| `cancelled` \| `at_risk` |
| `transactionIds` | L | YES | Array of constituent transaction ID strings |
| `amountVariance` | N | NO | Percentage variance in charge amounts |
| `dayVariance` | N | NO | Day-of-month variance |
| `previousStatus` | S | NO | Previous status on STATUS_CHANGED events |
| `previousAmount` | N | NO | Previous amount on AMOUNT_CHANGED events |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 180 days from event |

### Entity Relationship
```
USER (1) ──────── (*) DETECTED_SUBSCRIPTION
DETECTED_SUBSCRIPTION (*) ──────── (*) TRANSACTION  [via transactionIds list]
```

---

## Table 4: `vp-plaid-log`
**Domain:** Plaid Item Connections, Token Events

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `USER#{userId}` |
| `SK` | String | Sort Key | `PLAID#{itemId}#{eventType}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-itemId` | `itemId` | `timestamp_ms` | All events for a Plaid item |

### Attributes
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `USER#{userId}` |
| `SK` | S | YES | `PLAID#{itemId}#{eventType}#{timestamp_ms}` |
| `userId` | S | YES | Owner user ID |
| `itemId` | S | YES | Plaid Item ID |
| `eventType` | S | YES | `CONNECTED` \| `DISCONNECTED` \| `TOKEN_REFRESHED` \| `ERROR` |
| `institution` | S | NO | Bank institution name |
| `accounts` | L | NO | Array of `{ accountId, name, type, subtype }` |
| `errorCode` | S | NO | Plaid error code on ERROR events |
| `errorMessage` | S | NO | Error detail on ERROR events |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 365 days from event |

### Entity Relationship
```
USER (1) ──────── (*) PLAID_ITEM
PLAID_ITEM (1) ──────── (*) ACCOUNT  [accounts list in item]
```

---

## Table 5: `vp-stripe-log`
**Domain:** Stripe Webhook Events, Subscription State Changes

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `USER#{userId}` |
| `SK` | String | Sort Key | `STRIPE#{eventType}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-stripeSubId` | `stripeSubscriptionId` | `timestamp_ms` | Full lifecycle of a Stripe subscription |
| `GSI2-eventType-time` | `eventType` | `timestamp_ms` | All subscription.deleted events etc. |
| `GSI3-stripeEventId` | `stripeEventId` | — | Idempotency check: has this webhook been processed? |

### Attributes
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `USER#{userId}` |
| `SK` | S | YES | `STRIPE#{eventType}#{timestamp_ms}` |
| `userId` | S | YES | Platform user ID |
| `stripeEventId` | S | YES | Stripe event ID (`evt_...`) for deduplication |
| `stripeCustomerId` | S | YES | `cus_...` |
| `stripeSubscriptionId` | S | NO | `sub_...` |
| `eventType` | S | YES | Stripe event type e.g. `customer.subscription.created` |
| `productId` | S | NO | Stripe product ID |
| `productName` | S | NO | Product display name |
| `priceId` | S | NO | Stripe price ID |
| `amountCents` | N | NO | Amount in cents |
| `currency` | S | NO | ISO 4217 |
| `interval` | S | NO | `month` \| `year` |
| `status` | S | NO | Stripe subscription status |
| `cancelAtPeriodEnd` | BOOL | NO | Whether subscription will cancel |
| `currentPeriodEnd` | N | NO | Unix timestamp of period end |
| `trialEnd` | N | NO | Unix timestamp of trial end |
| `rawPayload` | S | NO | JSON string of full Stripe event object (truncated to 400KB) |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 365 days from event |

### Entity Relationship
```
USER (1) ──────── (*) STRIPE_SUBSCRIPTION
STRIPE_SUBSCRIPTION (1) ──────── (*) STRIPE_EVENT
STRIPE_EVENT (*) ──────── (1) STRIPE_PRODUCT
STRIPE_PRODUCT (1) ──────── (*) STRIPE_PRICE
```

---

## Table 6: `vp-enterprise-log`
**Domain:** Enterprise Orders, Approvals, Invoices, Customers

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `ORG#{customerId}` |
| `SK` | String | Sort Key | `{entityType}#{entityId}#{eventType}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-orderId-time` | `orderId` | `timestamp_ms` | Full lifecycle of a single order |
| `GSI2-salesPerson-time` | `salesPersonId` | `timestamp_ms` | All orders for a sales person |
| `GSI3-status-time` | `status` | `timestamp_ms` | Pipeline view: all `pending_finance` orders |
| `GSI4-invoiceId` | `invoiceId` | `timestamp_ms` | Invoice lifecycle |

### Attributes — Customer Events
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `ORG#{customerId}` |
| `SK` | S | YES | `CUSTOMER#{customerId}#CREATED#{timestamp_ms}` |
| `entityType` | S | YES | `CUSTOMER` |
| `eventType` | S | YES | `CREATED` \| `UPDATED` |
| `customerId` | S | YES | UUID |
| `name` | S | YES | Customer/org name |
| `orgType` | S | YES | `federal` \| `commercial` |
| `domain` | S | YES | Email domain |
| `billingEmail` | S | YES | Billing contact email |
| `billingContact` | S | YES | Name of billing contact |
| `phone` | S | NO | Contact phone |
| `address` | S | NO | Street address |
| `city` | S | NO | City |
| `state` | S | NO | State/province |
| `country` | S | YES | ISO country code |
| `contractNumber` | S | NO | Federal contract number |
| `agencyName` | S | NO | Federal agency name |
| `dunsNumber` | S | NO | Federal DUNS number |
| `industry` | S | NO | Commercial industry vertical |
| `website` | S | NO | Customer website URL |
| `createdBy` | S | YES | Actor user email |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 730 days |

### Attributes — Order Events
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `ORG#{customerId}` |
| `SK` | S | YES | `ORDER#{orderId}#{eventType}#{timestamp_ms}` |
| `entityType` | S | YES | `ORDER` |
| `eventType` | S | YES | `CREATED` \| `SUBMITTED` \| `APPROVED` \| `REJECTED` \| `INVOICED` \| `PAID` |
| `orderId` | S | YES | UUID |
| `orderNumber` | S | YES | `VP-YYYY-NNNN` |
| `customerId` | S | YES | FK → Customer |
| `customerName` | S | YES | Denormalized name |
| `lineItems` | L | YES | Array of `{ product, description, seats, unitPrice, term, discount, total }` |
| `subtotal` | N | YES | Pre-discount total USD |
| `totalDiscount` | N | YES | Total discount USD |
| `grandTotal` | N | YES | Final order value USD |
| `currency` | S | YES | ISO 4217, default `USD` |
| `paymentTerms` | S | YES | e.g. `Net 30` |
| `status` | S | YES | `draft` \| `submitted` \| `pending_finance` \| `approved` \| `rejected` \| `invoiced` \| `paid` |
| `salesPersonId` | S | YES | FK → User |
| `salesPersonEmail` | S | YES | Denormalized |
| `salesPersonName` | S | YES | Denormalized |
| `notes` | S | NO | Customer-facing notes |
| `internalNotes` | S | NO | Internal notes |
| `approvalHistory` | L | NO | Array of `{ stage, actorEmail, actorId, action, comment, timestamp }` |
| `invoiceId` | S | NO | FK → Invoice (set on INVOICED event) |
| `actorEmail` | S | NO | Who triggered this event |
| `actorComment` | S | NO | Approval/rejection comment |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 730 days |

### Attributes — Invoice Events
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `ORG#{customerId}` |
| `SK` | S | YES | `INVOICE#{invoiceId}#{eventType}#{timestamp_ms}` |
| `entityType` | S | YES | `INVOICE` |
| `eventType` | S | YES | `CREATED` \| `SENT` \| `VIEWED` \| `PAID` \| `OVERDUE` |
| `invoiceId` | S | YES | UUID |
| `invoiceNumber` | S | YES | `INV-YYYY-NNNN` |
| `orderId` | S | YES | FK → Order |
| `customerId` | S | YES | FK → Customer |
| `lineItems` | L | YES | Snapshot of line items at invoice time |
| `subtotal` | N | YES | USD |
| `grandTotal` | N | YES | USD |
| `currency` | S | YES | ISO 4217 |
| `paymentTerms` | S | YES | e.g. `Net 30` |
| `dueDate` | S | YES | `YYYY-MM-DD` |
| `status` | S | YES | `draft` \| `sent` \| `viewed` \| `paid` \| `overdue` |
| `sentTo` | S | NO | Recipient email |
| `createdBy` | S | YES | Actor email |
| `notes` | S | NO | Invoice notes |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 730 days |

### Entity Relationship
```
CUSTOMER (1) ──────── (*) ORDER
ORDER (1) ──────── (0..1) INVOICE
ORDER (1) ──────── (*) LINE_ITEM
ORDER (1) ──────── (*) APPROVAL_ENTRY
INVOICE (1) ──────── (*) LINE_ITEM [snapshot]
USER/SALES_PERSON (1) ──────── (*) ORDER
```

---

## Table 7: `vp-partner-log`
**Domain:** Partner Portal — License Seats, Members, Org Settings, Audit Trail

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `ORG#{orgId}` |
| `SK` | String | Sort Key | `{entityType}#{entityId}#{eventType}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-memberId-time` | `memberId` | `timestamp_ms` | All events for a specific member |
| `GSI2-actorEmail-time` | `actorEmail` | `timestamp_ms` | All actions performed by a user |
| `GSI3-email-time` | `memberEmail` | `timestamp_ms` | Look up member history by email |

### Attributes — Org Events
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `ORG#{orgId}` |
| `SK` | S | YES | `ORG#{orgId}#{eventType}#{timestamp_ms}` |
| `entityType` | S | YES | `ORG` |
| `eventType` | S | YES | `CREATED` \| `SETTINGS_CHANGED` \| `POOL_UPDATED` |
| `orgId` | S | YES | UUID |
| `orgName` | S | YES | Organization name |
| `orgType` | S | YES | `federal` \| `commercial` |
| `domain` | S | YES | Email domain |
| `licensePools` | M | YES | Map of `{ productKey: { total, reserved } }` |
| `ssoEnabled` | BOOL | YES | SSO status |
| `ssoProvider` | S | NO | SSO provider name |
| `agencyName` | S | NO | Federal agency |
| `fismaLevel` | S | NO | `low` \| `moderate` \| `high` |
| `contractNumber` | S | NO | Federal contract |
| `cotrEmail` | S | NO | Contracting Officer email |
| `accountManager` | S | NO | Commercial account manager |
| `actorEmail` | S | YES | Who made this change |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 730 days |

### Attributes — Member Events
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `ORG#{orgId}` |
| `SK` | S | YES | `MEMBER#{memberId}#{eventType}#{timestamp_ms}` |
| `entityType` | S | YES | `MEMBER` |
| `eventType` | S | YES | `ASSIGNED` \| `REVOKED` \| `SUSPENDED` \| `REINSTATED` \| `ROLE_CHANGED` \| `MODIFIED` |
| `memberId` | S | YES | UUID |
| `orgId` | S | YES | FK → Org |
| `memberEmail` | S | YES | Member email address |
| `name` | S | YES | Member display name |
| `department` | S | NO | Department/unit |
| `jobTitle` | S | NO | Job title |
| `role` | S | YES | `org_admin` \| `manager` \| `user` \| `viewer` |
| `previousRole` | S | NO | Previous role on ROLE_CHANGED |
| `productKeys` | L | YES | Array of product key strings assigned |
| `status` | S | YES | `active` \| `pending` \| `revoked` \| `suspended` |
| `previousStatus` | S | NO | Previous status on status change events |
| `accessLevel` | S | YES | `standard` \| `elevated` \| `top_secret` |
| `agencyCode` | S | NO | Federal agency code |
| `cacEnabled` | BOOL | NO | CAC/PIV card enabled |
| `clearanceLevel` | S | NO | Security clearance level |
| `costCenter` | S | NO | Commercial cost center |
| `managerId` | S | NO | Manager's member ID |
| `assignedBy` | S | YES | Assigning actor user ID |
| `actorEmail` | S | YES | Who performed this action |
| `ipAddress` | S | NO | Actor IP address |
| `notes` | S | NO | Notes on the action |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 730 days |

### Entity Relationship
```
ORG (1) ──────── (*) MEMBER
ORG (1) ──────── (1) LICENSE_POOL [per product]
LICENSE_POOL (1) ──────── (*) MEMBER [seat assignments]
ORG (1) ──────── (*) AUDIT_ENTRY
USER/ACTOR (1) ──────── (*) AUDIT_ENTRY
```

---

## Table 8: `vp-email-intel-log`
**Domain:** Email Account Connections, Scan Runs, Scan Errors

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `USER#{userId}` |
| `SK` | String | Sort Key | `{entityType}#{entityId}#{eventType}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-provider-time` | `provider` | `timestamp_ms` | All Gmail / Outlook / IMAP connections |
| `GSI2-email-time` | `connectedEmail` | `timestamp_ms` | Find connection by email address |
| `GSI3-status-time` | `status` | `timestamp_ms` | All errored connections |

### Attributes — Connection Events
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `USER#{userId}` |
| `SK` | S | YES | `CONN#{connectionId}#{eventType}#{timestamp_ms}` |
| `entityType` | S | YES | `CONNECTION` |
| `eventType` | S | YES | `CONNECTED` \| `DISCONNECTED` \| `ERROR` \| `TOKEN_REFRESHED` |
| `connectionId` | S | YES | UUID |
| `userId` | S | YES | Owner user ID |
| `provider` | S | YES | `gmail` \| `outlook` \| `imap` |
| `connectedEmail` | S | YES | Email address of the connected account |
| `status` | S | YES | `connected` \| `error` \| `disconnected` |
| `errorMessage` | S | NO | Error detail on ERROR events |
| `imapHost` | S | NO | IMAP server host (IMAP only, no password logged) |
| `imapPort` | N | NO | IMAP port |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 90 days |

### Attributes — Scan Run Events
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `USER#{userId}` |
| `SK` | S | YES | `SCAN#{runId}#{eventType}#{timestamp_ms}` |
| `entityType` | S | YES | `SCAN` |
| `eventType` | S | YES | `STARTED` \| `COMPLETED` \| `FAILED` |
| `runId` | S | YES | UUID |
| `userId` | S | YES | Owner user ID |
| `connectionId` | S | NO | Which connection was scanned |
| `provider` | S | NO | Provider of scanned account |
| `emailsProcessed` | N | NO | Count of emails read (set on COMPLETED) |
| `signalsFound` | N | NO | Total signals detected (set on COMPLETED) |
| `durationMs` | N | NO | Scan duration milliseconds |
| `errorMessage` | S | NO | Error detail on FAILED events |
| `trigger` | S | YES | `scheduled` \| `manual` \| `lambda` |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 90 days |

### Entity Relationship
```
USER (1) ──────── (*) EMAIL_CONNECTION
EMAIL_CONNECTION (1) ──────── (*) SCAN_RUN
SCAN_RUN (1) ──────── (*) SIGNAL [via vp-signals-log]
```

---

## Table 9: `vp-signals-log`
**Domain:** Product Signal Detections, NLP Insights per Email

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `USER#{userId}` |
| `SK` | String | Sort Key | `SIGNAL#{runId}#{productKey}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-productKey-urgency` | `productKey` | `urgency` | All high-urgency signals for RenewalGuard |
| `GSI2-runId-product` | `runId` | `productKey` | All signals from a specific scan run |
| `GSI3-userId-product` | `userId` | `productKey` | All signals for a user by product |

### Attributes — Product Insight Records
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `USER#{userId}` |
| `SK` | S | YES | `SIGNAL#{runId}#{productKey}#{timestamp_ms}` |
| `runId` | S | YES | FK → Scan Run |
| `userId` | S | YES | Owner user ID |
| `productKey` | S | YES | `renewalguard` \| `refundpilot` \| `followup` \| `leakageindex` \| `enterprisepilot` \| `drivepilot` \| `boarderpilot` |
| `productName` | S | YES | Display name e.g. `RenewalGuard™` |
| `accentColor` | S | YES | Hex color e.g. `#6366f1` |
| `signalCount` | N | YES | Number of matched signals |
| `avgConfidence` | N | YES | Average confidence score 0–1 |
| `topSignalType` | S | YES | Highest-scoring signal type |
| `urgency` | S | YES | `high` \| `medium` \| `low` \| `none` |
| `summary` | S | YES | Human-readable insight summary |
| `signals` | L | YES | Array of `DetectedSignal` objects (see below) |
| `entities` | M | NO | Extracted entities map |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 90 days |

### DetectedSignal (nested in `signals` list)
| Field | Type | Description |
|---|---|---|
| `signalType` | S | e.g. `RENEWAL_NOTICE`, `PRICE_INCREASE` |
| `confidence` | N | Score 0–1 |
| `tokenScore` | N | TF-IDF weighted phrase score |
| `matchedTokens` | L | Array of matched token strings |
| `snippet` | S | Source email snippet |
| `messageId` | S | Source email message ID |
| `subject` | S | Source email subject |
| `fromAddress` | S | Source email sender |
| `emailDate` | S | Source email date ISO 8601 |

### EmailEntities (nested in `entities` map)
| Field | Type | Description |
|---|---|---|
| `amounts` | L | `[{ value, currency, raw, context }]` |
| `dates` | L | `[{ raw, context }]` |
| `domains` | L | Vendor domains found |
| `actionVerbs` | L | Action verb phrases |
| `commitmentPhrases` | L | Commitment language |
| `deadlinePhrases` | L | Deadline language |
| `vendors` | L | Extracted vendor names |

### Entity Relationship
```
SCAN_RUN (1) ──────── (*) PRODUCT_INSIGHT
PRODUCT_INSIGHT (1) ──────── (*) DETECTED_SIGNAL
DETECTED_SIGNAL (*) ──────── (1) EMAIL_MESSAGE [reference by messageId]
```

---

## Table 10: `vp-alerts-log`
**Domain:** Lambda Renewal Alert Events (all 7 Python alert functions)

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `ACCOUNT#{accountId}` |
| `SK` | String | Sort Key | `ALERT#{alertType}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-alertType-time` | `alertType` | `timestamp_ms` | All alerts of a given type |
| `GSI2-subId-time` | `subscriptionId` | `timestamp_ms` | All alerts for a subscription |
| `GSI3-severity-time` | `severity` | `timestamp_ms` | All critical alerts across the platform |
| `GSI4-functionName-time` | `functionName` | `timestamp_ms` | Audit per Lambda function |

### Attributes
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `ACCOUNT#{accountId}` |
| `SK` | S | YES | `ALERT#{alertType}#{timestamp_ms}` |
| `alertId` | S | YES | UUID — deduplification key |
| `accountId` | S | YES | Customer account ID |
| `subscriptionId` | S | YES | Subscription being alerted |
| `alertType` | S | YES | `CANCELLATION_DEADLINE` \| `HIGH_RISK_ACCOUNTS` \| `PRICE_SHOCK` \| `USAGE_DECLINE` \| `PENDING_APPROVALS` \| `INCOMPLETE_EVIDENCE` \| `AUTO_RENEW_DISABLED` |
| `severity` | S | YES | `critical` \| `high` \| `medium` \| `low` |
| `functionName` | S | YES | AWS Lambda function name e.g. `valuepilot-cancellation-deadline-prod` |
| `provider` | S | NO | Subscription provider name |
| `segment` | S | NO | Customer segment label |
| `amount` | N | NO | Subscription amount USD |
| `alertPayload` | M | YES | Full event detail map (type-specific fields below) |
| `snsMessageId` | S | NO | SNS publish message ID |
| `snsTopicArn` | S | NO | Target SNS topic ARN |
| `eventBridgeId` | S | NO | Source EventBridge event ID |
| `status` | S | YES | `SENT` \| `FAILED` \| `SUPPRESSED` |
| `errorMessage` | S | NO | Lambda error detail on FAILED |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 90 days |

### alertPayload fields by alertType
| alertType | Key Fields |
|---|---|
| `CANCELLATION_DEADLINE` | `daysToCancellation` (N) |
| `HIGH_RISK_ACCOUNTS` | `riskScore` (N, 0–1), `riskThreshold` (N) |
| `PRICE_SHOCK` | `priceDelta` (N), `currentPlan` (N), `expectedAmount` (N) |
| `USAGE_DECLINE` | `usageChangePct` (N), `dropThreshold` (N) |
| `PENDING_APPROVALS` | `approvalStatus` (S), `escalationLevel` (N) |
| `INCOMPLETE_EVIDENCE` | `caseId` (S), `missingItems` (L) |
| `AUTO_RENEW_DISABLED` | `disabledSince` (S) |

### Entity Relationship
```
ACCOUNT (1) ──────── (*) ALERT
SUBSCRIPTION (1) ──────── (*) ALERT
LAMBDA_FUNCTION (1) ──────── (*) ALERT
ALERT (1) ──────── (0..1) SNS_MESSAGE
```

---

## Table 11: `vp-ml-inference-log`
**Domain:** ML Anomaly Detection Inference Requests and Results

### Primary Key
| Attribute | Type | Role | Pattern |
|---|---|---|---|
| `PK` | String | Partition Key | `ACCOUNT#{accountId}` |
| `SK` | String | Sort Key | `INFER#{inferenceId}#{timestamp_ms}` |

### GSIs
| Index Name | PK | SK | Purpose |
|---|---|---|---|
| `GSI1-userId-time` | `userId` | `timestamp_ms` | All inferences for a user |
| `GSI2-severity-time` | `topSeverity` | `timestamp_ms` | All `critical` inference results |
| `GSI3-inferenceId` | `inferenceId` | — | Direct lookup by inference ID |
| `GSI4-modelVersion-time` | `modelVersion` | `timestamp_ms` | Inferences run with a specific model version |

### Attributes
| Attribute | Type | Required | Description |
|---|---|---|---|
| `PK` | S | YES | `ACCOUNT#{accountId}` |
| `SK` | S | YES | `INFER#{inferenceId}#{timestamp_ms}` |
| `inferenceId` | S | YES | UUID |
| `accountId` | S | YES | Bank account ID |
| `userId` | S | YES | Requesting user ID |
| `modelVersion` | S | YES | ML model version string |
| `transactionsAnalyzed` | N | YES | Count of transactions sent to model |
| `anomalyCount` | N | YES | Number of anomalies detected |
| `topSeverity` | S | YES | Highest severity across all recommendations: `critical` \| `high` \| `medium` \| `low` \| `none` |
| `anomalies` | L | YES | Array of AnomalyResult objects |
| `patterns` | M | NO | PatternResult object |
| `recommendations` | L | YES | Array of Recommendation objects |
| `requestSource` | S | YES | `api` \| `scheduled` \| `webhook` |
| `processingMs` | N | NO | Inference duration milliseconds |
| `timestamp` | S | YES | ISO 8601 UTC |
| `timestamp_ms` | N | YES | Unix epoch milliseconds |
| `ttl` | N | YES | TTL — 90 days |

### AnomalyResult (nested in `anomalies` list)
| Field | Type | Description |
|---|---|---|
| `transactionId` | S | FK → Transaction |
| `isAnomaly` | BOOL | Classification result |
| `anomalyScore` | N | Score 0–1 |
| `reasons` | L | Array of reason strings |

### Recommendation (nested in `recommendations` list)
| Field | Type | Description |
|---|---|---|
| `severity` | S | `low` \| `medium` \| `high` \| `critical` |
| `category` | S | `fraud` \| `unusual_pattern` \| `high_value` \| `velocity` |
| `message` | S | Human-readable recommendation |
| `transactionIds` | L | Related transaction IDs |
| `recommendedAction` | S | Suggested action string |
| `confidence` | N | Confidence score 0–1 |

### Entity Relationship
```
USER (1) ──────── (*) INFERENCE_REQUEST
ACCOUNT (1) ──────── (*) INFERENCE_REQUEST
INFERENCE_REQUEST (1) ──────── (*) ANOMALY_RESULT
INFERENCE_REQUEST (1) ──────── (*) RECOMMENDATION
INFERENCE_REQUEST (1) ──────── (0..1) PATTERN_RESULT
ANOMALY_RESULT (*) ──────── (1) TRANSACTION
```

---

## Cross-Table Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VALUEPILOT PLATFORM                              │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │   USER       │  vp-users-log
  │  (userId)    │
  └──────┬───────┘
         │
    ┌────┴────────────────────────────────────────────────────────┐
    │                                                             │
    ▼                                                             ▼
┌──────────────────┐                                    ┌──────────────────┐
│  PLAID_ITEM      │  vp-plaid-log                      │  EMAIL_CONNECTION│  vp-email-intel-log
│  (itemId)        │                                    │  (connectionId)  │
└────────┬─────────┘                                    └────────┬─────────┘
         │                                                       │
         ▼                                                       ▼
┌──────────────────┐                                    ┌──────────────────┐
│  ACCOUNT         │  vp-transactions-log               │  SCAN_RUN        │  vp-email-intel-log
│  (accountId)     │                                    │  (runId)         │
└────────┬─────────┘                                    └────────┬─────────┘
         │                                                       │
    ┌────┴──────────┐                                    ┌───────┴────────────────────┐
    │               │                                    │                            │
    ▼               ▼                                    ▼                            ▼
┌─────────┐  ┌─────────────┐                 ┌──────────────────┐         ┌──────────────────┐
│TRANSACT │  │  DETECTED   │  vp-subscript-  │  PRODUCT_INSIGHT │         │  DETECTED_SIGNAL │
│(txnId)  │  │  SUBSCRIPT  │  ions-log       │  (productKey)    │         │  (signalType)    │
└────┬────┘  └─────────────┘                 └──────────────────┘         └──────────────────┘
     │                                         vp-signals-log
     ▼
┌──────────────────┐                  ┌──────────────────┐
│  ML_INFERENCE    │  vp-ml-          │  STRIPE_EVENT    │  vp-stripe-log
│  (inferenceId)   │  inference-log   │  (stripeEventId) │
└──────────────────┘                  └──────────────────┘

  ┌──────────────────┐                ┌──────────────────────────────────────────┐
  │  CUSTOMER        │                │  ORG                                     │
  │  (customerId)    │                │  (orgId)                                 │
  └────────┬─────────┘                └────────────────┬─────────────────────────┘
           │  vp-enterprise-log                        │  vp-partner-log
    ┌──────┴─────────┐                     ┌───────────┴───────────┐
    │                │                     │                       │
    ▼                ▼                     ▼                       ▼
┌─────────┐   ┌───────────┐         ┌───────────┐         ┌───────────────┐
│  ORDER  │   │  INVOICE  │         │  MEMBER   │         │  LICENSE_POOL │
│(orderId)│   │(invoiceId)│         │(memberId) │         │  (productKey) │
└────┬────┘   └───────────┘         └───────────┘         └───────────────┘
     │
     ▼
┌─────────────────┐
│  LINE_ITEM      │
│  APPROVAL_ENTRY │
└─────────────────┘

  ┌──────────────────┐
  │  ALERT           │  vp-alerts-log
  │  (alertId)       │
  │  [7 types]       │
  └──────────────────┘
    ← triggered by ACCOUNT + SUBSCRIPTION
    → published to SNS → valuepilot-alerts-prod
```

---

## DynamoDB Provisioning Summary

| Table | Billing Mode | Point-in-Time Recovery | Encryption | Stream |
|---|---|---|---|---|
| `vp-users-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_AND_OLD_IMAGES |
| `vp-transactions-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_IMAGE |
| `vp-subscriptions-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_IMAGE |
| `vp-plaid-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_IMAGE |
| `vp-stripe-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_IMAGE |
| `vp-enterprise-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_AND_OLD_IMAGES |
| `vp-partner-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_AND_OLD_IMAGES |
| `vp-email-intel-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_IMAGE |
| `vp-signals-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_IMAGE |
| `vp-alerts-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_AND_OLD_IMAGES |
| `vp-ml-inference-log` | On-Demand | YES | AWS_OWNED_KMS | NEW_IMAGE |

**Notes for DBA:**
- All tables use **On-Demand** billing — no capacity planning required at launch; switch to provisioned if write patterns become predictable.
- **PITR** enabled on all tables — 35-day recovery window included.
- **DynamoDB Streams** enabled where audit trail is critical (`users`, `enterprise`, `partner`, `alerts`).
- **TTL** is implemented via the `ttl` attribute (Unix epoch seconds). Enable TTL on every table using the attribute name `ttl`.
- **Never log plaintext credentials** — IMAP passwords, OAuth tokens, and Plaid access tokens must never appear in log items. Connection records log metadata only (host, port, email address).
- **Item size limit**: DynamoDB items are capped at 400KB. The `rawPayload` field in `vp-stripe-log` and the `signals` list in `vp-signals-log` must be truncated or stored in S3 with a reference key if they approach this limit.
- **Partition key design**: High-cardinality keys (`USER#{userId}`, `ACCOUNT#{accountId}`) prevent hot partitions.
