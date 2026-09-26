-- =============================================================
-- Vendor Reliability Intelligence Platform (VendorIQ)
-- PostgreSQL schema - Milestone 1 & Milestone 2
-- =============================================================
-- Covers:
--   M1  users / authentication / roles
--   M2  vendor management + approval workflow
--       procurement requests + approval workflow
--       purchase orders + line items + invoices
--       contracts, certifications and compliance monitoring
--       communication threads, messages and attachments
--       notifications and activity logs
--   M3  vendor_performance (scaffolded here, populated later)
-- =============================================================


-- =============================================================
-- 1. USERS & AUTHENTICATION
-- =============================================================

CREATE TABLE users (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              VARCHAR(100)  NOT NULL,
    email             VARCHAR(255)  NOT NULL UNIQUE,
    password_hash     VARCHAR(255)  NOT NULL,

    -- Administrator | Procurement Manager | Supply Chain Manager
    -- Vendor | Finance Officer | Auditor
    role              VARCHAR(50)   NOT NULL DEFAULT 'Procurement Manager',

    phone             VARCHAR(30),
    department        VARCHAR(100),
    job_title         VARCHAR(100),

    -- populated only when role = 'Vendor' (links the login to its supplier)
    vendor_id         BIGINT,

    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users (role);


CREATE TABLE password_reset_tokens (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           BIGINT        NOT NULL,
    token_hash        VARCHAR(255)  NOT NULL UNIQUE,
    expires_at        TIMESTAMPTZ   NOT NULL,
    used_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reset_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- =============================================================
-- 2. VENDOR MANAGEMENT
-- =============================================================

CREATE TABLE vendors (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_code          VARCHAR(30)   NOT NULL UNIQUE,
    vendor_name          VARCHAR(150)  NOT NULL,

    -- Raw Material Suppliers | Equipment Vendors | IT Vendors
    -- Service Providers | Logistics Partners | Maintenance Vendors
    category             VARCHAR(100)  NOT NULL,

    contact_person       VARCHAR(120),
    email                VARCHAR(255),
    phone                VARCHAR(30),
    website              VARCHAR(255),

    address              TEXT,
    city                 VARCHAR(100),
    country              VARCHAR(100),

    tax_id               VARCHAR(60),
    registration_number  VARCHAR(60),

    -- Pending | Approved | Rejected | Suspended | Inactive
    status               VARCHAR(50)   NOT NULL DEFAULT 'Pending',
    -- Low | Medium | High | Critical  (refined by the M3 scoring engine)
    risk_level           VARCHAR(20)   NOT NULL DEFAULT 'Medium',
    reliability_score    NUMERIC(5, 2),

    approved_by          BIGINT,
    approved_at          TIMESTAMPTZ,
    rejection_reason     TEXT,

    onboarded_on         DATE,
    notes                TEXT,

    created_by           BIGINT,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vendor_approver
        FOREIGN KEY (approved_by) REFERENCES users (id),
    CONSTRAINT fk_vendor_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE INDEX idx_vendors_status   ON vendors (status);
CREATE INDEX idx_vendors_category ON vendors (category);

ALTER TABLE users
    ADD CONSTRAINT fk_user_vendor
    FOREIGN KEY (vendor_id) REFERENCES vendors (id);


CREATE TABLE vendor_contacts (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id         BIGINT        NOT NULL,
    name              VARCHAR(120)  NOT NULL,
    designation       VARCHAR(100),
    email             VARCHAR(255),
    phone             VARCHAR(30),
    is_primary        BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_contact_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
);


-- Audit trail for the vendor approval workflow.
CREATE TABLE vendor_approvals (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id         BIGINT        NOT NULL,
    -- Submitted | Approved | Rejected | Suspended | Reactivated
    action            VARCHAR(50)   NOT NULL,
    previous_status   VARCHAR(50),
    new_status        VARCHAR(50)   NOT NULL,
    performed_by      BIGINT,
    comments          TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_approval_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_user
        FOREIGN KEY (performed_by) REFERENCES users (id)
);


-- =============================================================
-- 3. PROCUREMENT MANAGEMENT
-- =============================================================

CREATE TABLE procurement_requests (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_number      VARCHAR(50)   NOT NULL UNIQUE,
    requested_by        BIGINT        NOT NULL,

    item                VARCHAR(150)  NOT NULL,
    description         TEXT,
    category            VARCHAR(100),
    quantity            NUMERIC(12, 2) NOT NULL,
    unit                VARCHAR(30)   NOT NULL DEFAULT 'Units',
    estimated_cost      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency            VARCHAR(10)   NOT NULL DEFAULT 'USD',
    required_date       DATE,
    -- Low | Medium | High | Urgent
    priority            VARCHAR(20)   NOT NULL DEFAULT 'Medium',
    department          VARCHAR(100),
    justification       TEXT,

    -- Pending | Approved | Rejected | Ordered | Delivered | Completed | Cancelled
    status              VARCHAR(50)   NOT NULL DEFAULT 'Pending',

    assigned_vendor_id  BIGINT,
    approved_by         BIGINT,
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_procurement_user
        FOREIGN KEY (requested_by) REFERENCES users (id),
    CONSTRAINT fk_procurement_vendor
        FOREIGN KEY (assigned_vendor_id) REFERENCES vendors (id),
    CONSTRAINT fk_procurement_approver
        FOREIGN KEY (approved_by) REFERENCES users (id)
);

CREATE INDEX idx_requests_status ON procurement_requests (status);


-- Audit trail for the procurement approval workflow.
CREATE TABLE procurement_approvals (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id        BIGINT        NOT NULL,
    -- Submitted | Approved | Rejected | Vendor Assigned | Cancelled
    action            VARCHAR(50)   NOT NULL,
    previous_status   VARCHAR(50),
    new_status        VARCHAR(50)   NOT NULL,
    performed_by      BIGINT,
    comments          TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_proc_approval_request
        FOREIGN KEY (request_id) REFERENCES procurement_requests (id) ON DELETE CASCADE,
    CONSTRAINT fk_proc_approval_user
        FOREIGN KEY (performed_by) REFERENCES users (id)
);


-- =============================================================
-- 4. PURCHASE ORDERS & INVOICES
-- =============================================================

CREATE TABLE purchase_orders (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_number               VARCHAR(50)   NOT NULL UNIQUE,
    vendor_id               BIGINT        NOT NULL,
    procurement_request_id  BIGINT,
    created_by              BIGINT,

    title                   VARCHAR(200),
    description             TEXT,

    order_date              DATE          NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery       DATE,
    actual_delivery         DATE,

    currency                VARCHAR(10)   NOT NULL DEFAULT 'USD',
    subtotal                NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_amount              NUMERIC(15, 2) NOT NULL DEFAULT 0,
    shipping_amount         NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount            NUMERIC(15, 2) NOT NULL DEFAULT 0,

    payment_terms           VARCHAR(100),
    shipping_address        TEXT,
    notes                   TEXT,

    -- Pending | Approved | Ordered | Delivered | Completed | Cancelled
    status                  VARCHAR(50)   NOT NULL DEFAULT 'Pending',

    approved_by             BIGINT,
    approved_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_po_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id),
    CONSTRAINT fk_po_request
        FOREIGN KEY (procurement_request_id) REFERENCES procurement_requests (id),
    CONSTRAINT fk_po_creator
        FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_po_approver
        FOREIGN KEY (approved_by) REFERENCES users (id)
);

CREATE INDEX idx_po_status ON purchase_orders (status);
CREATE INDEX idx_po_vendor ON purchase_orders (vendor_id);


CREATE TABLE purchase_order_items (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_order_id  BIGINT        NOT NULL,
    item_name          VARCHAR(200)  NOT NULL,
    description        TEXT,
    quantity           NUMERIC(12, 2) NOT NULL DEFAULT 1,
    unit               VARCHAR(30)   NOT NULL DEFAULT 'Units',
    unit_price         NUMERIC(15, 2) NOT NULL DEFAULT 0,
    line_total         NUMERIC(15, 2) NOT NULL DEFAULT 0,

    CONSTRAINT fk_po_item_order
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE
);


CREATE TABLE invoices (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_number     VARCHAR(50)   NOT NULL UNIQUE,
    purchase_order_id  BIGINT,
    vendor_id          BIGINT        NOT NULL,

    invoice_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
    due_date           DATE,
    amount             NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_amount         NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount       NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency           VARCHAR(10)   NOT NULL DEFAULT 'USD',

    -- Pending | Approved | Paid | Overdue | Disputed
    status             VARCHAR(50)   NOT NULL DEFAULT 'Pending',
    payment_date       DATE,
    document_path      TEXT,
    notes              TEXT,

    created_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_invoice_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_invoice_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id)
);


-- =============================================================
-- 5. CONTRACTS & COMPLIANCE
-- =============================================================

CREATE TABLE contracts (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contract_number       VARCHAR(50)   NOT NULL UNIQUE,
    vendor_id             BIGINT        NOT NULL,

    title                 VARCHAR(200),
    -- Supply Agreement | Service Agreement | Master Agreement | SLA | NDA | Maintenance
    contract_type         VARCHAR(80)   NOT NULL DEFAULT 'Supply Agreement',

    start_date            DATE          NOT NULL,
    expiry_date           DATE          NOT NULL,
    contract_value        NUMERIC(15, 2),
    currency              VARCHAR(10)   NOT NULL DEFAULT 'USD',

    auto_renew            BOOLEAN       NOT NULL DEFAULT FALSE,
    renewal_notice_days   INTEGER       NOT NULL DEFAULT 30,
    renewed_from_id       BIGINT,

    -- Draft | Active | Expiring | Expired | Terminated | Renewed
    status                VARCHAR(50)   NOT NULL DEFAULT 'Draft',
    -- Compliant | Pending | Non-Compliant | Under Review
    compliance_status     VARCHAR(50)   NOT NULL DEFAULT 'Pending',

    document_path         TEXT,
    owner_id              BIGINT,
    terms                 TEXT,
    notes                 TEXT,

    created_at            TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_contract_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id),
    CONSTRAINT fk_contract_owner
        FOREIGN KEY (owner_id) REFERENCES users (id),
    CONSTRAINT fk_contract_renewed_from
        FOREIGN KEY (renewed_from_id) REFERENCES contracts (id)
);

CREATE INDEX idx_contracts_expiry ON contracts (expiry_date);
CREATE INDEX idx_contracts_status ON contracts (status);


CREATE TABLE vendor_certifications (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id             BIGINT        NOT NULL,
    certification_name    VARCHAR(150)  NOT NULL,
    issuing_authority     VARCHAR(150),
    certificate_number    VARCHAR(80),
    issue_date            DATE,
    expiry_date           DATE,
    -- Valid | Expiring | Expired | Revoked
    status                VARCHAR(50)   NOT NULL DEFAULT 'Valid',
    document_path         TEXT,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_certification_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
);


CREATE TABLE compliance_checks (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id         BIGINT        NOT NULL,
    contract_id       BIGINT,
    -- Documentation | Certification | Delivery Terms | Payment Terms | Quality | Regulatory
    check_type        VARCHAR(80)   NOT NULL,
    check_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
    -- Compliant | Partial | Non-Compliant
    result            VARCHAR(50)   NOT NULL DEFAULT 'Compliant',
    remarks           TEXT,
    checked_by        BIGINT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_compliance_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
    CONSTRAINT fk_compliance_contract
        FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
    CONSTRAINT fk_compliance_user
        FOREIGN KEY (checked_by) REFERENCES users (id)
);


-- =============================================================
-- 6. COMMUNICATION
-- =============================================================

CREATE TABLE message_threads (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject                 VARCHAR(200)  NOT NULL,
    vendor_id               BIGINT,
    purchase_order_id       BIGINT,
    procurement_request_id  BIGINT,
    contract_id             BIGINT,

    created_by              BIGINT        NOT NULL,
    -- Open | Awaiting Vendor | Awaiting Internal | Resolved | Closed
    status                  VARCHAR(50)   NOT NULL DEFAULT 'Open',
    -- Low | Medium | High | Urgent
    priority                VARCHAR(20)   NOT NULL DEFAULT 'Medium',

    last_message_at         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_thread_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
    CONSTRAINT fk_thread_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE SET NULL,
    CONSTRAINT fk_thread_request
        FOREIGN KEY (procurement_request_id) REFERENCES procurement_requests (id) ON DELETE SET NULL,
    CONSTRAINT fk_thread_contract
        FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE SET NULL,
    CONSTRAINT fk_thread_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
);


CREATE TABLE messages (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    thread_id         BIGINT        NOT NULL,
    sender_id         BIGINT        NOT NULL,
    body              TEXT          NOT NULL,
    is_read           BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_message_thread
        FOREIGN KEY (thread_id) REFERENCES message_threads (id) ON DELETE CASCADE,
    CONSTRAINT fk_message_sender
        FOREIGN KEY (sender_id) REFERENCES users (id)
);

CREATE INDEX idx_messages_thread ON messages (thread_id);


CREATE TABLE message_attachments (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id        BIGINT        NOT NULL,
    file_name         VARCHAR(255)  NOT NULL,
    file_path         TEXT          NOT NULL,
    file_size         BIGINT,
    content_type      VARCHAR(120),
    uploaded_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_attachment_message
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
);


-- =============================================================
-- 7. NOTIFICATIONS & ACTIVITY LOGS
-- =============================================================

CREATE TABLE notifications (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            BIGINT        NOT NULL,
    -- Procurement | Delivery | Vendor Approval | Contract Expiry | Compliance | Message | System
    notification_type  VARCHAR(50)   NOT NULL,
    title              VARCHAR(200)  NOT NULL,
    message            TEXT          NOT NULL,
    link               VARCHAR(255),
    -- Low | Medium | High
    priority           VARCHAR(20)   NOT NULL DEFAULT 'Medium',
    is_read            BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications (user_id, is_read);


CREATE TABLE activity_logs (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           BIGINT,
    -- Vendor | ProcurementRequest | PurchaseOrder | Contract | Invoice | User | Thread
    entity_type       VARCHAR(60)   NOT NULL,
    entity_id         BIGINT,
    action            VARCHAR(80)   NOT NULL,
    description       TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_activity_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_entity ON activity_logs (entity_type, entity_id);


-- =============================================================
-- 8. VENDOR PERFORMANCE  (Milestone 3 - scaffolded)
-- =============================================================

CREATE TABLE vendor_performance (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id               BIGINT        NOT NULL,
    purchase_order_id       BIGINT,
    evaluation_date         DATE          NOT NULL DEFAULT CURRENT_DATE,

    on_time_delivery        NUMERIC(5, 2),
    delayed_delivery        NUMERIC(5, 2),
    quality_rating          NUMERIC(3, 2),
    response_time           NUMERIC(10, 2),
    issue_resolution_time   NUMERIC(10, 2),
    order_completion_rate   NUMERIC(5, 2),
    service_rating          NUMERIC(3, 2),
    remarks                 TEXT,

    created_at              TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_performance_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
    CONSTRAINT fk_performance_purchase_order
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE SET NULL
);


-- =============================================================
-- 9. MILESTONE 3 - RELIABILITY, PREDICTION & REPORTING
-- =============================================================

-- Point-in-time snapshot of the six-factor reliability calculation.
-- One row per vendor per recalculation, so trends can be charted.
CREATE TABLE vendor_reliability_scores (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id               BIGINT        NOT NULL,
    score_date              DATE          NOT NULL DEFAULT CURRENT_DATE,

    -- the six reliability factors, each normalised to 0-100
    delivery_score          NUMERIC(5, 2) NOT NULL DEFAULT 0,
    quality_score           NUMERIC(5, 2) NOT NULL DEFAULT 0,
    communication_score     NUMERIC(5, 2) NOT NULL DEFAULT 0,
    compliance_score        NUMERIC(5, 2) NOT NULL DEFAULT 0,
    purchase_history_score  NUMERIC(5, 2) NOT NULL DEFAULT 0,
    issue_resolution_score  NUMERIC(5, 2) NOT NULL DEFAULT 0,

    overall_score           NUMERIC(5, 2) NOT NULL DEFAULT 0,
    -- Low | Medium | High | Critical
    risk_level              VARCHAR(20)   NOT NULL DEFAULT 'Medium',
    rank_position           INTEGER,

    -- supporting counters kept so a score can be explained after the fact
    orders_considered       INTEGER       NOT NULL DEFAULT 0,
    on_time_deliveries      INTEGER       NOT NULL DEFAULT 0,
    delayed_deliveries      INTEGER       NOT NULL DEFAULT 0,
    avg_delay_days          NUMERIC(8, 2),
    total_spend             NUMERIC(18, 2) NOT NULL DEFAULT 0,

    -- model-driven forward looking risk (0-1 probability of a late delivery)
    predicted_delay_risk    NUMERIC(5, 4),
    trend                   VARCHAR(20),          -- Improving | Stable | Declining
    recommendation          TEXT,
    calculated_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reliability_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
);

CREATE INDEX idx_reliability_vendor ON vendor_reliability_scores (vendor_id, score_date DESC);
CREATE UNIQUE INDEX uq_reliability_vendor_day
    ON vendor_reliability_scores (vendor_id, score_date);


-- Output of the delivery-delay classifier for a single purchase order.
CREATE TABLE delay_predictions (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_order_id    BIGINT        NOT NULL,
    vendor_id            BIGINT        NOT NULL,

    delay_probability    NUMERIC(5, 4) NOT NULL,
    predicted_late       BOOLEAN       NOT NULL DEFAULT FALSE,
    -- Low | Medium | High | Critical
    risk_band            VARCHAR(20)   NOT NULL DEFAULT 'Low',
    model_version        VARCHAR(40),
    features             TEXT,          -- JSON snapshot of the model inputs
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_prediction_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_prediction_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
);

CREATE INDEX idx_prediction_po ON delay_predictions (purchase_order_id, created_at DESC);


-- Audit trail for the reporting module (who exported what, and when).
CREATE TABLE report_runs (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_key        VARCHAR(60)   NOT NULL,
    export_format     VARCHAR(10)   NOT NULL DEFAULT 'json',
    filters           TEXT,
    row_count         INTEGER       NOT NULL DEFAULT 0,
    generated_by      BIGINT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_report_user
        FOREIGN KEY (generated_by) REFERENCES users (id) ON DELETE SET NULL
);


-- Delivery channels are tracked per notification so the Notification module
-- can prove an email / SMS was dispatched rather than only rendered in-app.
ALTER TABLE notifications
    ADD COLUMN channel      VARCHAR(20)  NOT NULL DEFAULT 'In-App',
    ADD COLUMN email_sent   BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN sms_sent     BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN event_key    VARCHAR(120);

-- Lets the alert sweep stay idempotent: one alert per event, per user.
CREATE UNIQUE INDEX uq_notification_event
    ON notifications (user_id, event_key)
    WHERE event_key IS NOT NULL;


-- The purchase order carries the lane attributes the delay model needs.
ALTER TABLE purchase_orders
    ADD COLUMN shipping_mode   VARCHAR(40),
    ADD COLUMN market          VARCHAR(40),
    ADD COLUMN order_region    VARCHAR(60),
    ADD COLUMN source_ref      VARCHAR(60);

CREATE INDEX idx_po_order_date ON purchase_orders (order_date);
CREATE INDEX idx_performance_vendor_date
    ON vendor_performance (vendor_id, evaluation_date);
