--
-- PostgreSQL database dump
--

\restrict U6bGQRfVqGuyAhVyjl46iExqdnYK3TQt8V4GlSFcpXZrbxsGi6WDY69I4nm1fus

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id bigint NOT NULL,
    user_id bigint,
    entity_type character varying(60) NOT NULL,
    entity_id bigint,
    action character varying(80) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.activity_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: compliance_checks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_checks (
    id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    contract_id bigint,
    check_type character varying(80) NOT NULL,
    check_date date DEFAULT CURRENT_DATE NOT NULL,
    result character varying(50) DEFAULT 'Compliant'::character varying NOT NULL,
    remarks text,
    checked_by bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.compliance_checks OWNER TO postgres;

--
-- Name: compliance_checks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.compliance_checks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.compliance_checks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id bigint NOT NULL,
    contract_number character varying(50) NOT NULL,
    vendor_id bigint NOT NULL,
    title character varying(200),
    contract_type character varying(80) DEFAULT 'Supply Agreement'::character varying NOT NULL,
    start_date date NOT NULL,
    expiry_date date NOT NULL,
    contract_value numeric(15,2),
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    auto_renew boolean DEFAULT false NOT NULL,
    renewal_notice_days integer DEFAULT 30 NOT NULL,
    renewed_from_id bigint,
    status character varying(50) DEFAULT 'Draft'::character varying NOT NULL,
    compliance_status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    document_path text,
    owner_id bigint,
    terms text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.contracts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contracts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id bigint NOT NULL,
    invoice_number character varying(50) NOT NULL,
    purchase_order_id bigint,
    vendor_id bigint NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    payment_date date,
    document_path text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.invoices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_attachments (
    id bigint NOT NULL,
    message_id bigint NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    content_type character varying(120),
    uploaded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.message_attachments OWNER TO postgres;

--
-- Name: message_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.message_attachments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.message_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: message_threads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_threads (
    id bigint NOT NULL,
    subject character varying(200) NOT NULL,
    vendor_id bigint,
    purchase_order_id bigint,
    procurement_request_id bigint,
    contract_id bigint,
    created_by bigint NOT NULL,
    status character varying(50) DEFAULT 'Open'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'Medium'::character varying NOT NULL,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.message_threads OWNER TO postgres;

--
-- Name: message_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.message_threads ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.message_threads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id bigint NOT NULL,
    thread_id bigint NOT NULL,
    sender_id bigint NOT NULL,
    body text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    notification_type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    link character varying(255),
    priority character varying(20) DEFAULT 'Medium'::character varying NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.password_reset_tokens ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.password_reset_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: procurement_approvals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.procurement_approvals (
    id bigint NOT NULL,
    request_id bigint NOT NULL,
    action character varying(50) NOT NULL,
    previous_status character varying(50),
    new_status character varying(50) NOT NULL,
    performed_by bigint,
    comments text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.procurement_approvals OWNER TO postgres;

--
-- Name: procurement_approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.procurement_approvals ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.procurement_approvals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: procurement_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.procurement_requests (
    id bigint NOT NULL,
    request_number character varying(50) NOT NULL,
    requested_by bigint NOT NULL,
    item character varying(150) NOT NULL,
    description text,
    category character varying(100),
    quantity numeric(12,2) NOT NULL,
    unit character varying(30) DEFAULT 'Units'::character varying NOT NULL,
    estimated_cost numeric(15,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    required_date date,
    priority character varying(20) DEFAULT 'Medium'::character varying NOT NULL,
    department character varying(100),
    justification text,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    assigned_vendor_id bigint,
    approved_by bigint,
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.procurement_requests OWNER TO postgres;

--
-- Name: procurement_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.procurement_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.procurement_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    id bigint NOT NULL,
    purchase_order_id bigint NOT NULL,
    item_name character varying(200) NOT NULL,
    description text,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    unit character varying(30) DEFAULT 'Units'::character varying NOT NULL,
    unit_price numeric(15,2) DEFAULT 0 NOT NULL,
    line_total numeric(15,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_order_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.purchase_order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id bigint NOT NULL,
    po_number character varying(50) NOT NULL,
    vendor_id bigint NOT NULL,
    procurement_request_id bigint,
    created_by bigint,
    title character varying(200),
    description text,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_delivery date,
    actual_delivery date,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    subtotal numeric(15,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
    shipping_amount numeric(15,2) DEFAULT 0 NOT NULL,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    payment_terms character varying(100),
    shipping_address text,
    notes text,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    approved_by bigint,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_orders ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.purchase_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'Procurement Manager'::character varying NOT NULL,
    phone character varying(30),
    department character varying(100),
    job_title character varying(100),
    vendor_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vendor_approvals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_approvals (
    id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    action character varying(50) NOT NULL,
    previous_status character varying(50),
    new_status character varying(50) NOT NULL,
    performed_by bigint,
    comments text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.vendor_approvals OWNER TO postgres;

--
-- Name: vendor_approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.vendor_approvals ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.vendor_approvals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vendor_certifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_certifications (
    id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    certification_name character varying(150) NOT NULL,
    issuing_authority character varying(150),
    certificate_number character varying(80),
    issue_date date,
    expiry_date date,
    status character varying(50) DEFAULT 'Valid'::character varying NOT NULL,
    document_path text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.vendor_certifications OWNER TO postgres;

--
-- Name: vendor_certifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.vendor_certifications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.vendor_certifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vendor_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_contacts (
    id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    name character varying(120) NOT NULL,
    designation character varying(100),
    email character varying(255),
    phone character varying(30),
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.vendor_contacts OWNER TO postgres;

--
-- Name: vendor_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.vendor_contacts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.vendor_contacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vendor_performance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_performance (
    id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    purchase_order_id bigint,
    evaluation_date date DEFAULT CURRENT_DATE NOT NULL,
    on_time_delivery numeric(5,2),
    delayed_delivery numeric(5,2),
    quality_rating numeric(3,2),
    response_time numeric(10,2),
    issue_resolution_time numeric(10,2),
    order_completion_rate numeric(5,2),
    service_rating numeric(3,2),
    remarks text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.vendor_performance OWNER TO postgres;

--
-- Name: vendor_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.vendor_performance ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.vendor_performance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    id bigint NOT NULL,
    vendor_code character varying(30) NOT NULL,
    vendor_name character varying(150) NOT NULL,
    category character varying(100) NOT NULL,
    contact_person character varying(120),
    email character varying(255),
    phone character varying(30),
    website character varying(255),
    address text,
    city character varying(100),
    country character varying(100),
    tax_id character varying(60),
    registration_number character varying(60),
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    risk_level character varying(20) DEFAULT 'Medium'::character varying NOT NULL,
    reliability_score numeric(5,2),
    approved_by bigint,
    approved_at timestamp with time zone,
    rejection_reason text,
    onboarded_on date,
    notes text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.vendors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.vendors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, user_id, entity_type, entity_id, action, description, created_at) FROM stdin;
1	2	Vendor	\N	Registered	Vendor onboarding batch loaded	2026-09-02 11:12:41.05493+05:30
2	2	ProcurementRequest	\N	Created	Quarterly requests raised	2026-09-02 11:12:41.05493+05:30
3	2	PurchaseOrder	\N	Created	Purchase orders issued to suppliers	2026-09-02 11:12:41.05493+05:30
4	3	Contract	\N	Compliance Check	Periodic compliance reviews completed	2026-09-02 11:12:41.05493+05:30
5	1	User	\N	Created	Demo accounts provisioned	2026-09-02 11:12:41.05493+05:30
6	5	User	5	Password Reset	Password reset using a reset token	2026-09-02 11:15:09.859714+05:30
7	2	Vendor	12	Registered	Vendor 'Aurora Components Ltd' (VND-0012) registered	2026-09-02 11:15:10.480701+05:30
8	2	Vendor	12	Approved	Vendor 'Aurora Components Ltd' approved	2026-09-02 11:15:10.573214+05:30
9	2	Vendor	12	Suspended	Vendor 'Aurora Components Ltd' suspended	2026-09-02 11:15:10.601379+05:30
10	2	Vendor	12	Reactivated	Vendor 'Aurora Components Ltd' reactivated	2026-09-02 11:15:10.610352+05:30
11	3	ProcurementRequest	11	Created	Request PR-2026-0011 for 'Hydraulic press seals' created	2026-09-02 11:15:10.661444+05:30
12	2	ProcurementRequest	11	Vendor Assigned	Request PR-2026-0011 assigned to Ironclad Maintenance Co.	2026-09-02 11:15:10.798652+05:30
13	2	ProcurementRequest	11	Approved	Request PR-2026-0011 approved	2026-09-02 11:15:10.823654+05:30
14	2	PurchaseOrder	5	Created	Purchase order PO-2026-0005 raised for Ironclad Maintenance Co. (USD 7896)	2026-09-02 11:15:10.912531+05:30
15	2	PurchaseOrder	5	Status: Approved	PO-2026-0005 moved from Pending to Approved	2026-09-02 11:15:11.03405+05:30
16	2	PurchaseOrder	5	Status: Ordered	PO-2026-0005 moved from Approved to Ordered	2026-09-02 11:15:11.065622+05:30
17	2	PurchaseOrder	5	Status: Delivered	PO-2026-0005 moved from Ordered to Delivered	2026-09-02 11:15:11.089859+05:30
18	2	PurchaseOrder	5	Status: Completed	PO-2026-0005 moved from Delivered to Completed	2026-09-02 11:15:11.127259+05:30
19	4	Invoice	\N	Created	Invoice INV-2026-0005 recorded against PO-2026-0005	2026-09-02 11:15:11.184682+05:30
20	4	Invoice	3	Updated	Invoice INV-2026-0005 updated (status Paid)	2026-09-02 11:15:11.227085+05:30
21	2	Contract	8	Created	Contract CT-2026-0008 created for Ironclad Maintenance Co.	2026-09-02 11:15:11.373777+05:30
22	3	Contract	8	Compliance Check	Certification check on CT-2026-0008: Non-Compliant	2026-09-02 11:15:11.420947+05:30
23	3	Contract	8	Compliance Check	Certification check on CT-2026-0008: Compliant	2026-09-02 11:15:11.499696+05:30
24	2	Contract	9	Renewed	Contract CT-2026-0008 renewed as CT-2026-0009	2026-09-02 11:15:11.556501+05:30
25	2	Vendor	6	Certification Added	'ISO 45001 Occupational Health & Safety' recorded for Ironclad Maintenance Co.	2026-09-02 11:15:11.81469+05:30
26	2	Thread	5	Created	Conversation 'Seal kit delivery confirmation' started	2026-09-02 11:15:11.905097+05:30
27	2	Thread	5	Updated	Conversation 'Seal kit delivery confirmation' updated (status Closed)	2026-09-02 11:15:12.031985+05:30
28	5	User	5	Password Reset	Password reset using a reset token	2026-09-02 18:44:53.659653+05:30
29	2	Vendor	13	Registered	Vendor 'Aurora Components Ltd' (VND-0013) registered	2026-09-02 18:44:54.438121+05:30
30	2	Vendor	13	Approved	Vendor 'Aurora Components Ltd' approved	2026-09-02 18:44:54.522022+05:30
31	2	Vendor	13	Suspended	Vendor 'Aurora Components Ltd' suspended	2026-09-02 18:44:54.546583+05:30
32	2	Vendor	13	Reactivated	Vendor 'Aurora Components Ltd' reactivated	2026-09-02 18:44:54.557448+05:30
33	3	ProcurementRequest	12	Created	Request PR-2026-0012 for 'Hydraulic press seals' created	2026-09-02 18:44:54.617344+05:30
34	2	ProcurementRequest	12	Vendor Assigned	Request PR-2026-0012 assigned to Ironclad Maintenance Co.	2026-09-02 18:44:54.671998+05:30
35	2	ProcurementRequest	12	Approved	Request PR-2026-0012 approved	2026-09-02 18:44:54.687388+05:30
36	2	PurchaseOrder	6	Created	Purchase order PO-2026-0006 raised for Ironclad Maintenance Co. (USD 7896)	2026-09-02 18:44:54.748281+05:30
37	2	PurchaseOrder	6	Status: Approved	PO-2026-0006 moved from Pending to Approved	2026-09-02 18:44:54.828045+05:30
38	2	PurchaseOrder	6	Status: Ordered	PO-2026-0006 moved from Approved to Ordered	2026-09-02 18:44:54.843302+05:30
39	2	PurchaseOrder	6	Status: Delivered	PO-2026-0006 moved from Ordered to Delivered	2026-09-02 18:44:54.85725+05:30
40	2	PurchaseOrder	6	Status: Completed	PO-2026-0006 moved from Delivered to Completed	2026-09-02 18:44:54.883817+05:30
41	4	Invoice	\N	Created	Invoice INV-2026-0006 recorded against PO-2026-0006	2026-09-02 18:44:54.924134+05:30
42	4	Invoice	4	Updated	Invoice INV-2026-0006 updated (status Paid)	2026-09-02 18:44:54.967563+05:30
43	2	Contract	10	Created	Contract CT-2026-0010 created for Ironclad Maintenance Co.	2026-09-02 18:44:55.079317+05:30
44	3	Contract	10	Compliance Check	Certification check on CT-2026-0010: Non-Compliant	2026-09-02 18:44:55.123472+05:30
45	3	Contract	10	Compliance Check	Certification check on CT-2026-0010: Compliant	2026-09-02 18:44:55.151729+05:30
46	2	Contract	11	Renewed	Contract CT-2026-0010 renewed as CT-2026-0011	2026-09-02 18:44:55.173621+05:30
47	2	Vendor	6	Certification Added	'ISO 45001 Occupational Health & Safety' recorded for Ironclad Maintenance Co.	2026-09-02 18:44:55.358663+05:30
48	2	Thread	6	Created	Conversation 'Seal kit delivery confirmation' started	2026-09-02 18:44:55.442374+05:30
49	2	Thread	6	Updated	Conversation 'Seal kit delivery confirmation' updated (status Closed)	2026-09-02 18:44:55.523979+05:30
50	5	User	5	Password Reset	Password reset using a reset token	2026-09-02 18:46:24.525499+05:30
51	2	Vendor	14	Registered	Vendor 'Aurora Components Ltd' (VND-0014) registered	2026-09-02 18:46:25.500692+05:30
52	2	Vendor	14	Approved	Vendor 'Aurora Components Ltd' approved	2026-09-02 18:46:25.58581+05:30
53	2	Vendor	14	Suspended	Vendor 'Aurora Components Ltd' suspended	2026-09-02 18:46:25.625834+05:30
54	2	Vendor	14	Reactivated	Vendor 'Aurora Components Ltd' reactivated	2026-09-02 18:46:25.644123+05:30
55	3	ProcurementRequest	13	Created	Request PR-2026-0013 for 'Hydraulic press seals' created	2026-09-02 18:46:25.742573+05:30
56	2	ProcurementRequest	13	Vendor Assigned	Request PR-2026-0013 assigned to Ironclad Maintenance Co.	2026-09-02 18:46:25.846385+05:30
57	2	ProcurementRequest	13	Approved	Request PR-2026-0013 approved	2026-09-02 18:46:25.871789+05:30
58	2	PurchaseOrder	7	Created	Purchase order PO-2026-0007 raised for Ironclad Maintenance Co. (USD 7896)	2026-09-02 18:46:25.958047+05:30
59	2	PurchaseOrder	7	Status: Approved	PO-2026-0007 moved from Pending to Approved	2026-09-02 18:46:26.054221+05:30
60	2	PurchaseOrder	7	Status: Ordered	PO-2026-0007 moved from Approved to Ordered	2026-09-02 18:46:26.072315+05:30
61	2	PurchaseOrder	7	Status: Delivered	PO-2026-0007 moved from Ordered to Delivered	2026-09-02 18:46:26.091381+05:30
62	2	PurchaseOrder	7	Status: Completed	PO-2026-0007 moved from Delivered to Completed	2026-09-02 18:46:26.12242+05:30
63	4	Invoice	\N	Created	Invoice INV-2026-0007 recorded against PO-2026-0007	2026-09-02 18:46:26.173873+05:30
64	4	Invoice	5	Updated	Invoice INV-2026-0007 updated (status Paid)	2026-09-02 18:46:26.198989+05:30
65	2	Contract	12	Created	Contract CT-2026-0012 created for Ironclad Maintenance Co.	2026-09-02 18:46:26.324721+05:30
66	3	Contract	12	Compliance Check	Certification check on CT-2026-0012: Non-Compliant	2026-09-02 18:46:26.351501+05:30
67	3	Contract	12	Compliance Check	Certification check on CT-2026-0012: Compliant	2026-09-02 18:46:26.384451+05:30
68	2	Contract	13	Renewed	Contract CT-2026-0012 renewed as CT-2026-0013	2026-09-02 18:46:26.411812+05:30
69	2	Vendor	6	Certification Added	'ISO 45001 Occupational Health & Safety' recorded for Ironclad Maintenance Co.	2026-09-02 18:46:26.486075+05:30
70	2	Thread	7	Created	Conversation 'Seal kit delivery confirmation' started	2026-09-02 18:46:26.530236+05:30
71	2	Thread	7	Updated	Conversation 'Seal kit delivery confirmation' updated (status Closed)	2026-09-02 18:46:26.612606+05:30
72	5	User	5	Password Reset	Password reset using a reset token	2026-09-02 18:50:29.416196+05:30
73	2	Vendor	15	Registered	Vendor 'Aurora Components Ltd' (VND-0015) registered	2026-09-02 18:50:29.937184+05:30
74	2	Vendor	15	Approved	Vendor 'Aurora Components Ltd' approved	2026-09-02 18:50:29.964954+05:30
75	2	Vendor	15	Suspended	Vendor 'Aurora Components Ltd' suspended	2026-09-02 18:50:29.982516+05:30
76	2	Vendor	15	Reactivated	Vendor 'Aurora Components Ltd' reactivated	2026-09-02 18:50:29.991214+05:30
77	3	ProcurementRequest	14	Created	Request PR-2026-0014 for 'Hydraulic press seals' created	2026-09-02 18:50:30.03047+05:30
78	2	ProcurementRequest	14	Vendor Assigned	Request PR-2026-0014 assigned to Ironclad Maintenance Co.	2026-09-02 18:50:30.068808+05:30
79	2	ProcurementRequest	14	Approved	Request PR-2026-0014 approved	2026-09-02 18:50:30.081398+05:30
80	2	PurchaseOrder	8	Created	Purchase order PO-2026-0008 raised for Ironclad Maintenance Co. (USD 7896)	2026-09-02 18:50:30.140443+05:30
81	2	PurchaseOrder	8	Status: Approved	PO-2026-0008 moved from Pending to Approved	2026-09-02 18:50:30.204811+05:30
82	2	PurchaseOrder	8	Status: Ordered	PO-2026-0008 moved from Approved to Ordered	2026-09-02 18:50:30.220554+05:30
83	2	PurchaseOrder	8	Status: Delivered	PO-2026-0008 moved from Ordered to Delivered	2026-09-02 18:50:30.238291+05:30
84	2	PurchaseOrder	8	Status: Completed	PO-2026-0008 moved from Delivered to Completed	2026-09-02 18:50:30.269431+05:30
85	4	Invoice	\N	Created	Invoice INV-2026-0008 recorded against PO-2026-0008	2026-09-02 18:50:30.326577+05:30
86	4	Invoice	6	Updated	Invoice INV-2026-0008 updated (status Paid)	2026-09-02 18:50:30.347478+05:30
87	2	Contract	14	Created	Contract CT-2026-0014 created for Ironclad Maintenance Co.	2026-09-02 18:50:30.436455+05:30
88	3	Contract	14	Compliance Check	Certification check on CT-2026-0014: Non-Compliant	2026-09-02 18:50:30.463291+05:30
89	3	Contract	14	Compliance Check	Certification check on CT-2026-0014: Compliant	2026-09-02 18:50:30.49665+05:30
90	2	Contract	15	Renewed	Contract CT-2026-0014 renewed as CT-2026-0015	2026-09-02 18:50:30.517419+05:30
91	2	Vendor	6	Certification Added	'ISO 45001 Occupational Health & Safety' recorded for Ironclad Maintenance Co.	2026-09-02 18:50:30.571701+05:30
92	2	Thread	8	Created	Conversation 'Seal kit delivery confirmation' started	2026-09-02 18:50:30.610076+05:30
93	2	Thread	8	Updated	Conversation 'Seal kit delivery confirmation' updated (status Closed)	2026-09-02 18:50:30.680483+05:30
\.


--
-- Data for Name: compliance_checks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compliance_checks (id, vendor_id, contract_id, check_type, check_date, result, remarks, checked_by, created_at) FROM stdin;
1	1	1	Quality	2026-05-07	Compliant	Periodic compliance review	3	2026-09-02 11:12:41.05493+05:30
2	2	2	Delivery Terms	2026-07-05	Compliant	Periodic compliance review	3	2026-09-02 11:12:41.05493+05:30
3	3	3	Certification	2026-07-07	Partial	Periodic compliance review	3	2026-09-02 11:12:41.05493+05:30
4	4	4	Documentation	2026-07-14	Non-Compliant	Periodic compliance review	3	2026-09-02 11:12:41.05493+05:30
5	5	5	Delivery Terms	2026-08-07	Compliant	Periodic compliance review	3	2026-09-02 11:12:41.05493+05:30
6	6	6	Delivery Terms	2026-07-17	Compliant	Periodic compliance review	3	2026-09-02 11:12:41.05493+05:30
7	7	7	Delivery Terms	2026-08-14	Compliant	Periodic compliance review	3	2026-09-02 11:12:41.05493+05:30
8	6	8	Certification	2026-09-02	Non-Compliant	ISO 45001 certificate lapsed	3	2026-09-02 11:15:11.420947+05:30
9	6	8	Certification	2026-09-02	Compliant	\N	3	2026-09-02 11:15:11.499696+05:30
10	6	10	Certification	2026-09-02	Non-Compliant	ISO 45001 certificate lapsed	3	2026-09-02 18:44:55.123472+05:30
11	6	10	Certification	2026-09-02	Compliant	\N	3	2026-09-02 18:44:55.151729+05:30
12	6	12	Certification	2026-09-02	Non-Compliant	ISO 45001 certificate lapsed	3	2026-09-02 18:46:26.351501+05:30
13	6	12	Certification	2026-09-02	Compliant	\N	3	2026-09-02 18:46:26.384451+05:30
14	6	14	Certification	2026-09-02	Non-Compliant	ISO 45001 certificate lapsed	3	2026-09-02 18:50:30.463291+05:30
15	6	14	Certification	2026-09-02	Compliant	\N	3	2026-09-02 18:50:30.49665+05:30
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contracts (id, contract_number, vendor_id, title, contract_type, start_date, expiry_date, contract_value, currency, auto_renew, renewal_notice_days, renewed_from_id, status, compliance_status, document_path, owner_id, terms, notes, created_at, updated_at) FROM stdin;
1	CT-2026-0001	1	Supply Agreement - Northwind Steel Works	Supply Agreement	2024-10-02	2027-10-07	480000.00	USD	f	30	\N	Active	Compliant	\N	2	Standard commercial terms apply. Delivery penalties of 2% per week accrue on late shipments.	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
2	CT-2026-0002	2	Master Agreement - Meridian Precision Tools	Master Agreement	2025-04-20	2027-04-10	1250000.00	USD	f	30	\N	Active	Compliant	\N	2	Standard commercial terms apply. Delivery penalties of 2% per week accrue on late shipments.	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
3	CT-2026-0003	3	Service Level Agreement - Arclight Systems	Service Level Agreement	2025-07-29	2026-09-20	96000.00	USD	t	30	\N	Expiring	Under Review	\N	2	Standard commercial terms apply. Delivery penalties of 2% per week accrue on late shipments.	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
4	CT-2026-0004	4	Maintenance Agreement - Kestrel Logistics Group	Maintenance Agreement	2025-01-10	2026-09-14	145000.00	USD	f	30	\N	Expiring	Non-Compliant	\N	2	Standard commercial terms apply. Delivery penalties of 2% per week accrue on late shipments.	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
5	CT-2026-0005	5	Service Agreement - Vantage Facility Services	Service Agreement	2025-11-06	2028-05-14	210000.00	USD	f	30	\N	Active	Compliant	\N	2	Standard commercial terms apply. Delivery penalties of 2% per week accrue on late shipments.	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
6	CT-2026-0006	6	Supply Agreement - Ironclad Maintenance Co.	Supply Agreement	2024-03-16	2026-07-24	320000.00	USD	t	30	\N	Expired	Compliant	\N	2	Standard commercial terms apply. Delivery penalties of 2% per week accrue on late shipments.	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
7	CT-2026-0007	7	Non-Disclosure Agreement - Cobalt Polymer Supply	Non-Disclosure Agreement	2026-02-14	2029-02-18	\N	USD	f	30	\N	Active	Pending	\N	2	Standard commercial terms apply. Delivery penalties of 2% per week accrue on late shipments.	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
8	CT-2026-0008	6	Maintenance retainer 2026	Maintenance Agreement	2026-09-02	2027-09-02	148000.00	USD	f	30	\N	Renewed	Compliant	\N	2	\N	\N	2026-09-02 11:15:11.373777+05:30	2026-09-02 11:15:11.556501+05:30
9	CT-2026-0009	6	Maintenance retainer 2026	Maintenance Agreement	2027-09-03	2028-09-01	155000.00	USD	f	30	8	Active	Pending	\N	2	\N	\N	2026-09-02 11:15:11.556501+05:30	2026-09-02 11:15:11.556501+05:30
10	CT-2026-0010	6	Maintenance retainer 2026	Maintenance Agreement	2026-09-02	2027-09-02	148000.00	USD	f	30	\N	Renewed	Compliant	\N	2	\N	\N	2026-09-02 18:44:55.079317+05:30	2026-09-02 18:44:55.173621+05:30
11	CT-2026-0011	6	Maintenance retainer 2026	Maintenance Agreement	2027-09-03	2028-09-01	155000.00	USD	f	30	10	Active	Pending	\N	2	\N	\N	2026-09-02 18:44:55.173621+05:30	2026-09-02 18:44:55.173621+05:30
12	CT-2026-0012	6	Maintenance retainer 2026	Maintenance Agreement	2026-09-02	2027-09-02	148000.00	USD	f	30	\N	Renewed	Compliant	\N	2	\N	\N	2026-09-02 18:46:26.324721+05:30	2026-09-02 18:46:26.411812+05:30
13	CT-2026-0013	6	Maintenance retainer 2026	Maintenance Agreement	2027-09-03	2028-09-01	155000.00	USD	f	30	12	Active	Pending	\N	2	\N	\N	2026-09-02 18:46:26.411812+05:30	2026-09-02 18:46:26.411812+05:30
14	CT-2026-0014	6	Maintenance retainer 2026	Maintenance Agreement	2026-09-02	2027-09-02	148000.00	USD	f	30	\N	Renewed	Compliant	\N	2	\N	\N	2026-09-02 18:50:30.436455+05:30	2026-09-02 18:50:30.517419+05:30
15	CT-2026-0015	6	Maintenance retainer 2026	Maintenance Agreement	2027-09-03	2028-09-01	155000.00	USD	f	30	14	Active	Pending	\N	2	\N	\N	2026-09-02 18:50:30.517419+05:30	2026-09-02 18:50:30.517419+05:30
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, invoice_number, purchase_order_id, vendor_id, invoice_date, due_date, amount, tax_amount, total_amount, currency, status, payment_date, document_path, notes, created_at, updated_at) FROM stdin;
1	INV-2026-0003	3	6	2026-07-02	2026-08-01	9600.00	768.00	11268.00	USD	Pending	\N	\N	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
2	INV-2026-0004	4	5	2026-06-23	2026-07-23	28800.00	2304.00	32004.00	USD	Paid	2026-07-21	\N	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
3	INV-2026-0005	5	6	2026-09-02	2026-11-01	7080.00	576.00	7656.00	USD	Paid	2026-09-02	\N	\N	2026-09-02 11:15:11.184682+05:30	2026-09-02 11:15:11.227085+05:30
4	INV-2026-0006	6	6	2026-09-02	2026-11-01	7080.00	576.00	7656.00	USD	Paid	2026-09-02	\N	\N	2026-09-02 18:44:54.924134+05:30	2026-09-02 18:44:54.967563+05:30
5	INV-2026-0007	7	6	2026-09-02	2026-11-01	7080.00	576.00	7656.00	USD	Paid	2026-09-02	\N	\N	2026-09-02 18:46:26.173873+05:30	2026-09-02 18:46:26.198989+05:30
6	INV-2026-0008	8	6	2026-09-02	2026-11-01	7080.00	576.00	7656.00	USD	Paid	2026-09-02	\N	\N	2026-09-02 18:50:30.326577+05:30	2026-09-02 18:50:30.347478+05:30
\.


--
-- Data for Name: message_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_attachments (id, message_id, file_name, file_path, file_size, content_type, uploaded_at) FROM stdin;
\.


--
-- Data for Name: message_threads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_threads (id, subject, vendor_id, purchase_order_id, procurement_request_id, contract_id, created_by, status, priority, last_message_at, created_at, updated_at) FROM stdin;
1	Delivery schedule for PO batch 3	1	1	\N	\N	2	Open	High	2026-08-26 11:12:43.109956+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
2	Revised quotation - polymer pellets	2	2	\N	\N	2	Awaiting Vendor	Medium	2026-08-27 11:12:43.128996+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
3	Quality deviation on last shipment	3	3	\N	\N	2	Awaiting Internal	Urgent	2026-08-15 11:12:43.15403+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
4	Contract renewal discussion	4	4	\N	\N	2	Resolved	Medium	2026-08-15 11:12:43.163783+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
5	Seal kit delivery confirmation	6	5	\N	\N	2	Closed	High	2026-09-02 11:15:11.974159+05:30	2026-09-02 11:15:11.905097+05:30	2026-09-02 11:15:12.031985+05:30
6	Seal kit delivery confirmation	6	6	\N	\N	2	Closed	High	2026-09-02 18:44:55.49328+05:30	2026-09-02 18:44:55.442374+05:30	2026-09-02 18:44:55.523979+05:30
7	Seal kit delivery confirmation	6	7	\N	\N	2	Closed	High	2026-09-02 18:46:26.567111+05:30	2026-09-02 18:46:26.530236+05:30	2026-09-02 18:46:26.612606+05:30
8	Seal kit delivery confirmation	6	8	\N	\N	2	Closed	High	2026-09-02 18:50:30.643362+05:30	2026-09-02 18:50:30.610076+05:30	2026-09-02 18:50:30.680483+05:30
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, thread_id, sender_id, body, is_read, created_at) FROM stdin;
1	1	2	Could you confirm the dispatch date for the outstanding lines? Our plant window closes at the end of next week.	t	2026-09-02 11:12:41.05493+05:30
2	1	6	Dispatch is booked for Tuesday. I will share the tracking reference as soon as the carrier confirms collection.	t	2026-09-02 11:12:41.05493+05:30
3	2	2	Please send a revised quotation reflecting the updated volumes in the attached schedule.	t	2026-09-02 11:12:41.05493+05:30
4	2	7	Revised pricing attached. The unit rate drops by 4% at the higher volume tier.	t	2026-09-02 11:12:41.05493+05:30
5	3	2	Batch 4471 failed incoming inspection on surface finish. Please raise a corrective action report.	t	2026-09-02 11:12:41.05493+05:30
6	3	8	Acknowledged. Our quality team is investigating and we will revert with the CAR within 48 hours.	f	2026-09-02 11:12:41.05493+05:30
7	4	2	The current agreement expires shortly - can we start renewal discussions this month?	t	2026-09-02 11:12:41.05493+05:30
8	4	3	Yes, happy to. I will circulate our proposed terms before Friday.	t	2026-09-02 11:12:41.05493+05:30
9	5	2	Please confirm the dispatch date for the seal kits.	f	2026-09-02 11:15:11.905097+05:30
10	5	3	Following up internally.	t	2026-09-02 11:15:11.971677+05:30
11	6	2	Please confirm the dispatch date for the seal kits.	f	2026-09-02 18:44:55.442374+05:30
12	6	3	Following up internally.	t	2026-09-02 18:44:55.49114+05:30
13	7	2	Please confirm the dispatch date for the seal kits.	f	2026-09-02 18:46:26.530236+05:30
14	7	3	Following up internally.	t	2026-09-02 18:46:26.56486+05:30
15	8	2	Please confirm the dispatch date for the seal kits.	f	2026-09-02 18:50:30.610076+05:30
16	8	3	Following up internally.	t	2026-09-02 18:50:30.6415+05:30
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, notification_type, title, message, link, priority, is_read, created_at) FROM stdin;
1	1	Vendor Approval	New vendor awaiting approval	Halcyon Freight Partners (VND-0008) has been registered and is waiting for approval.	/vendors/8	High	f	2026-09-02 11:12:41.05493+05:30
3	1	Vendor Approval	New vendor awaiting approval	Quantum Cloud Networks (VND-0009) has been registered and is waiting for approval.	/vendors/9	High	f	2026-09-02 11:12:41.05493+05:30
5	1	Contract Expiry	Contract expiring soon	CT-2026-0003 expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 11:12:41.05493+05:30
7	1	Contract Expiry	Contract expiring soon	CT-2026-0004 expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	f	2026-09-02 11:12:41.05493+05:30
9	4	Procurement	Invoices awaiting approval	There are outstanding vendor invoices pending review.	/invoices	Medium	f	2026-09-02 11:12:41.05493+05:30
10	1	Vendor Approval	New vendor awaiting approval	Aurora Components Ltd (VND-0012) has been registered and is waiting for approval.	/vendors/12	High	f	2026-09-02 11:15:10.480701+05:30
11	1	Procurement	New procurement request	PR-2026-0011 - Hydraulic press seals (USD 7200) awaits approval.	/procurement/11	High	f	2026-09-02 11:15:10.661444+05:30
13	3	Procurement	Procurement request approved	PR-2026-0011 (Hydraulic press seals) was approved by David Mwangi. A purchase order can now be raised.	/procurement/11	High	f	2026-09-02 11:15:10.823654+05:30
14	1	Procurement	New purchase order raised	PO-2026-0005 for Ironclad Maintenance Co. (USD 7896) is awaiting approval.	/purchase-orders/5	Medium	f	2026-09-02 11:15:10.912531+05:30
15	4	Procurement	New purchase order raised	PO-2026-0005 for Ironclad Maintenance Co. (USD 7896) is awaiting approval.	/purchase-orders/5	Medium	f	2026-09-02 11:15:10.912531+05:30
16	1	Delivery	Delivery delay recorded	PO-2026-0005 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/5	High	f	2026-09-02 11:15:11.089859+05:30
18	3	Delivery	Delivery delay recorded	PO-2026-0005 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/5	High	f	2026-09-02 11:15:11.089859+05:30
19	1	Compliance	Compliance breach recorded	CT-2026-0008 failed a Certification check.	/contracts/8	High	f	2026-09-02 11:15:11.420947+05:30
21	5	Compliance	Compliance breach recorded	CT-2026-0008 failed a Certification check.	/contracts/8	High	f	2026-09-02 11:15:11.420947+05:30
22	1	Contract Expiry	Contract expiring soon	CT-2026-0003 with Arclight Systems expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 11:15:11.664895+05:30
24	8	Contract Expiry	Contract expiring soon	CT-2026-0003 expires on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 11:15:11.664895+05:30
25	1	Contract Expiry	Contract expiring soon	CT-2026-0004 with Kestrel Logistics Group expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	f	2026-09-02 11:15:11.664895+05:30
27	2	Message	New reply on your conversation	Sofia Ramirez replied on 'Seal kit delivery confirmation'.	/communication/5	Medium	t	2026-09-02 11:15:11.971677+05:30
2	2	Vendor Approval	New vendor awaiting approval	Halcyon Freight Partners (VND-0008) has been registered and is waiting for approval.	/vendors/8	High	t	2026-09-02 11:12:41.05493+05:30
4	2	Vendor Approval	New vendor awaiting approval	Quantum Cloud Networks (VND-0009) has been registered and is waiting for approval.	/vendors/9	High	t	2026-09-02 11:12:41.05493+05:30
6	2	Contract Expiry	Contract expiring soon	CT-2026-0003 expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	t	2026-09-02 11:12:41.05493+05:30
8	2	Contract Expiry	Contract expiring soon	CT-2026-0004 expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	t	2026-09-02 11:12:41.05493+05:30
12	2	Procurement	New procurement request	PR-2026-0011 - Hydraulic press seals (USD 7200) awaits approval.	/procurement/11	High	t	2026-09-02 11:15:10.661444+05:30
17	2	Delivery	Delivery delay recorded	PO-2026-0005 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/5	High	t	2026-09-02 11:15:11.089859+05:30
20	2	Compliance	Compliance breach recorded	CT-2026-0008 failed a Certification check.	/contracts/8	High	t	2026-09-02 11:15:11.420947+05:30
23	2	Contract Expiry	Contract expiring soon	CT-2026-0003 with Arclight Systems expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	t	2026-09-02 11:15:11.664895+05:30
26	2	Contract Expiry	Contract expiring soon	CT-2026-0004 with Kestrel Logistics Group expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	t	2026-09-02 11:15:11.664895+05:30
28	1	Vendor Approval	New vendor awaiting approval	Aurora Components Ltd (VND-0013) has been registered and is waiting for approval.	/vendors/13	High	f	2026-09-02 18:44:54.438121+05:30
29	1	Procurement	New procurement request	PR-2026-0012 - Hydraulic press seals (USD 7200) awaits approval.	/procurement/12	High	f	2026-09-02 18:44:54.617344+05:30
31	3	Procurement	Procurement request approved	PR-2026-0012 (Hydraulic press seals) was approved by David Mwangi. A purchase order can now be raised.	/procurement/12	High	f	2026-09-02 18:44:54.687388+05:30
32	1	Procurement	New purchase order raised	PO-2026-0006 for Ironclad Maintenance Co. (USD 7896) is awaiting approval.	/purchase-orders/6	Medium	f	2026-09-02 18:44:54.748281+05:30
33	4	Procurement	New purchase order raised	PO-2026-0006 for Ironclad Maintenance Co. (USD 7896) is awaiting approval.	/purchase-orders/6	Medium	f	2026-09-02 18:44:54.748281+05:30
34	1	Delivery	Delivery delay recorded	PO-2026-0006 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/6	High	f	2026-09-02 18:44:54.85725+05:30
30	2	Procurement	New procurement request	PR-2026-0012 - Hydraulic press seals (USD 7200) awaits approval.	/procurement/12	High	t	2026-09-02 18:44:54.617344+05:30
36	3	Delivery	Delivery delay recorded	PO-2026-0006 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/6	High	f	2026-09-02 18:44:54.85725+05:30
37	1	Compliance	Compliance breach recorded	CT-2026-0010 failed a Certification check.	/contracts/10	High	f	2026-09-02 18:44:55.123472+05:30
39	5	Compliance	Compliance breach recorded	CT-2026-0010 failed a Certification check.	/contracts/10	High	f	2026-09-02 18:44:55.123472+05:30
40	1	Contract Expiry	Contract expiring soon	CT-2026-0003 with Arclight Systems expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 18:44:55.210152+05:30
42	8	Contract Expiry	Contract expiring soon	CT-2026-0003 expires on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 18:44:55.210152+05:30
43	1	Contract Expiry	Contract expiring soon	CT-2026-0004 with Kestrel Logistics Group expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	f	2026-09-02 18:44:55.210152+05:30
45	2	Message	New reply on your conversation	Sofia Ramirez replied on 'Seal kit delivery confirmation'.	/communication/6	Medium	t	2026-09-02 18:44:55.49114+05:30
35	2	Delivery	Delivery delay recorded	PO-2026-0006 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/6	High	t	2026-09-02 18:44:54.85725+05:30
38	2	Compliance	Compliance breach recorded	CT-2026-0010 failed a Certification check.	/contracts/10	High	t	2026-09-02 18:44:55.123472+05:30
41	2	Contract Expiry	Contract expiring soon	CT-2026-0003 with Arclight Systems expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	t	2026-09-02 18:44:55.210152+05:30
44	2	Contract Expiry	Contract expiring soon	CT-2026-0004 with Kestrel Logistics Group expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	t	2026-09-02 18:44:55.210152+05:30
46	1	Vendor Approval	New vendor awaiting approval	Aurora Components Ltd (VND-0014) has been registered and is waiting for approval.	/vendors/14	High	f	2026-09-02 18:46:25.500692+05:30
47	1	Procurement	New procurement request	PR-2026-0013 - Hydraulic press seals (USD 7200) awaits approval.	/procurement/13	High	f	2026-09-02 18:46:25.742573+05:30
49	3	Procurement	Procurement request approved	PR-2026-0013 (Hydraulic press seals) was approved by David Mwangi. A purchase order can now be raised.	/procurement/13	High	f	2026-09-02 18:46:25.871789+05:30
50	1	Procurement	New purchase order raised	PO-2026-0007 for Ironclad Maintenance Co. (USD 7896) is awaiting approval.	/purchase-orders/7	Medium	f	2026-09-02 18:46:25.958047+05:30
51	4	Procurement	New purchase order raised	PO-2026-0007 for Ironclad Maintenance Co. (USD 7896) is awaiting approval.	/purchase-orders/7	Medium	f	2026-09-02 18:46:25.958047+05:30
52	1	Delivery	Delivery delay recorded	PO-2026-0007 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/7	High	f	2026-09-02 18:46:26.091381+05:30
54	3	Delivery	Delivery delay recorded	PO-2026-0007 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/7	High	f	2026-09-02 18:46:26.091381+05:30
55	5	Compliance	Compliance breach recorded	CT-2026-0012 failed a Certification check.	/contracts/12	High	f	2026-09-02 18:46:26.351501+05:30
56	1	Compliance	Compliance breach recorded	CT-2026-0012 failed a Certification check.	/contracts/12	High	f	2026-09-02 18:46:26.351501+05:30
58	1	Contract Expiry	Contract expiring soon	CT-2026-0003 with Arclight Systems expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 18:46:26.4591+05:30
60	8	Contract Expiry	Contract expiring soon	CT-2026-0003 expires on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 18:46:26.4591+05:30
61	1	Contract Expiry	Contract expiring soon	CT-2026-0004 with Kestrel Logistics Group expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	f	2026-09-02 18:46:26.4591+05:30
63	2	Message	New reply on your conversation	Sofia Ramirez replied on 'Seal kit delivery confirmation'.	/communication/7	Medium	t	2026-09-02 18:46:26.56486+05:30
48	2	Procurement	New procurement request	PR-2026-0013 - Hydraulic press seals (USD 7200) awaits approval.	/procurement/13	High	t	2026-09-02 18:46:25.742573+05:30
53	2	Delivery	Delivery delay recorded	PO-2026-0007 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/7	High	t	2026-09-02 18:46:26.091381+05:30
57	2	Compliance	Compliance breach recorded	CT-2026-0012 failed a Certification check.	/contracts/12	High	t	2026-09-02 18:46:26.351501+05:30
59	2	Contract Expiry	Contract expiring soon	CT-2026-0003 with Arclight Systems expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	t	2026-09-02 18:46:26.4591+05:30
62	2	Contract Expiry	Contract expiring soon	CT-2026-0004 with Kestrel Logistics Group expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	t	2026-09-02 18:46:26.4591+05:30
64	1	Vendor Approval	New vendor awaiting approval	Aurora Components Ltd (VND-0015) has been registered and is waiting for approval.	/vendors/15	High	f	2026-09-02 18:50:29.937184+05:30
65	1	Procurement	New procurement request	PR-2026-0014 - Hydraulic press seals (USD 7200) awaits approval.	/procurement/14	High	f	2026-09-02 18:50:30.03047+05:30
67	3	Procurement	Procurement request approved	PR-2026-0014 (Hydraulic press seals) was approved by David Mwangi. A purchase order can now be raised.	/procurement/14	High	f	2026-09-02 18:50:30.081398+05:30
66	2	Procurement	New procurement request	PR-2026-0014 - Hydraulic press seals (USD 7200) awaits approval.	/procurement/14	High	t	2026-09-02 18:50:30.03047+05:30
68	1	Procurement	New purchase order raised	PO-2026-0008 for Ironclad Maintenance Co. (USD 7896) is awaiting approval.	/purchase-orders/8	Medium	f	2026-09-02 18:50:30.140443+05:30
69	4	Procurement	New purchase order raised	PO-2026-0008 for Ironclad Maintenance Co. (USD 7896) is awaiting approval.	/purchase-orders/8	Medium	f	2026-09-02 18:50:30.140443+05:30
70	1	Delivery	Delivery delay recorded	PO-2026-0008 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/8	High	f	2026-09-02 18:50:30.238291+05:30
72	3	Delivery	Delivery delay recorded	PO-2026-0008 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/8	High	f	2026-09-02 18:50:30.238291+05:30
73	1	Compliance	Compliance breach recorded	CT-2026-0014 failed a Certification check.	/contracts/14	High	f	2026-09-02 18:50:30.463291+05:30
75	5	Compliance	Compliance breach recorded	CT-2026-0014 failed a Certification check.	/contracts/14	High	f	2026-09-02 18:50:30.463291+05:30
76	1	Contract Expiry	Contract expiring soon	CT-2026-0003 with Arclight Systems expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 18:50:30.553744+05:30
78	8	Contract Expiry	Contract expiring soon	CT-2026-0003 expires on 2026-09-20.	/contracts/3	Medium	f	2026-09-02 18:50:30.553744+05:30
79	1	Contract Expiry	Contract expiring soon	CT-2026-0004 with Kestrel Logistics Group expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	f	2026-09-02 18:50:30.553744+05:30
81	2	Message	New reply on your conversation	Sofia Ramirez replied on 'Seal kit delivery confirmation'.	/communication/8	Medium	t	2026-09-02 18:50:30.6415+05:30
71	2	Delivery	Delivery delay recorded	PO-2026-0008 from Ironclad Maintenance Co. arrived 7 day(s) after the expected date.	/purchase-orders/8	High	t	2026-09-02 18:50:30.238291+05:30
74	2	Compliance	Compliance breach recorded	CT-2026-0014 failed a Certification check.	/contracts/14	High	t	2026-09-02 18:50:30.463291+05:30
77	2	Contract Expiry	Contract expiring soon	CT-2026-0003 with Arclight Systems expires in 18 day(s) on 2026-09-20.	/contracts/3	Medium	t	2026-09-02 18:50:30.553744+05:30
80	2	Contract Expiry	Contract expiring soon	CT-2026-0004 with Kestrel Logistics Group expires in 12 day(s) on 2026-09-14.	/contracts/4	Medium	t	2026-09-02 18:50:30.553744+05:30
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
1	5	f19321e9707e787ac67d6d2024961f1833d552e471dc9033699bc679ab3d727c	2026-09-02 11:45:09.821805+05:30	2026-09-02 11:15:10.133449+05:30	2026-09-02 11:15:09.820923+05:30
2	5	e268eda51aac281d7e202dcd8b72a065df0be62047de4da51fbe231b35e1eb3b	2026-09-02 19:14:53.611454+05:30	2026-09-02 18:44:54.037086+05:30	2026-09-02 18:44:53.609343+05:30
3	5	e16b7607efe9dc692e1c52017d7249d3aad45d7f05c142ff74e957b356fc1d6c	2026-09-02 19:16:24.512918+05:30	2026-09-02 18:46:24.934078+05:30	2026-09-02 18:46:24.511964+05:30
4	5	3322aa6105a4338e24e250fe9c865e0dd9dc7513352c9c89f69417c155a566a7	2026-09-02 19:20:29.406902+05:30	2026-09-02 18:50:29.660824+05:30	2026-09-02 18:50:29.405435+05:30
\.


--
-- Data for Name: procurement_approvals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.procurement_approvals (id, request_id, action, previous_status, new_status, performed_by, comments, created_at) FROM stdin;
1	1	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
2	2	Submitted	\N	Pending	2	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
3	3	Submitted	\N	Pending	2	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
4	3	Approved	Pending	Approved	2	Approved against the departmental budget	2026-09-02 11:12:41.05493+05:30
5	4	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
6	4	Approved	Pending	Approved	2	Approved against the departmental budget	2026-09-02 11:12:41.05493+05:30
7	5	Submitted	\N	Pending	2	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
8	5	Approved	Pending	Approved	2	Approved against the departmental budget	2026-09-02 11:12:41.05493+05:30
9	6	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
10	6	Approved	Pending	Approved	2	Approved against the departmental budget	2026-09-02 11:12:41.05493+05:30
11	7	Submitted	\N	Pending	2	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
12	7	Approved	Pending	Approved	2	Approved against the departmental budget	2026-09-02 11:12:41.05493+05:30
13	8	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
14	8	Approved	Pending	Approved	2	Approved against the departmental budget	2026-09-02 11:12:41.05493+05:30
15	9	Submitted	\N	Pending	2	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
16	9	Rejected	Pending	Rejected	2	Budget not available in the current quarter; resubmit in Q3.	2026-09-02 11:12:41.05493+05:30
17	10	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 11:12:41.05493+05:30
18	11	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 11:15:10.661444+05:30
19	11	Vendor Assigned	Pending	Pending	2	Assigned to Ironclad Maintenance Co.	2026-09-02 11:15:10.798652+05:30
20	11	Approved	Pending	Approved	2	Budget confirmed	2026-09-02 11:15:10.823654+05:30
21	12	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 18:44:54.617344+05:30
22	12	Vendor Assigned	Pending	Pending	2	Assigned to Ironclad Maintenance Co.	2026-09-02 18:44:54.671998+05:30
23	12	Approved	Pending	Approved	2	Budget confirmed	2026-09-02 18:44:54.687388+05:30
24	13	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 18:46:25.742573+05:30
25	13	Vendor Assigned	Pending	Pending	2	Assigned to Ironclad Maintenance Co.	2026-09-02 18:46:25.846385+05:30
26	13	Approved	Pending	Approved	2	Budget confirmed	2026-09-02 18:46:25.871789+05:30
27	14	Submitted	\N	Pending	3	Procurement request submitted for approval	2026-09-02 18:50:30.03047+05:30
28	14	Vendor Assigned	Pending	Pending	2	Assigned to Ironclad Maintenance Co.	2026-09-02 18:50:30.068808+05:30
29	14	Approved	Pending	Approved	2	Budget confirmed	2026-09-02 18:50:30.081398+05:30
\.


--
-- Data for Name: procurement_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.procurement_requests (id, request_number, requested_by, item, description, category, quantity, unit, estimated_cost, currency, required_date, priority, department, justification, status, assigned_vendor_id, approved_by, approved_at, rejection_reason, created_at, updated_at) FROM stdin;
1	PR-2026-0001	3	CNC tool holders BT40	CNC tool holders BT40 required for scheduled engineering work.	Equipment Vendors	120.00	Units	18400.00	USD	2026-09-29	High	Engineering	Replenishment against the approved annual operating plan.	Pending	\N	\N	\N	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
2	PR-2026-0002	2	Cold-rolled steel coil, 2mm	Cold-rolled steel coil, 2mm required for scheduled production work.	Raw Material Suppliers	45.00	Tonnes	96500.00	USD	2026-06-15	Urgent	Production	Replenishment against the approved annual operating plan.	Pending	\N	\N	\N	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
3	PR-2026-0003	2	Warehouse rack replacement bays	Warehouse rack replacement bays required for scheduled warehouse work.	Equipment Vendors	30.00	Units	22750.00	USD	2026-05-26	Medium	Warehouse	Replenishment against the approved annual operating plan.	Approved	2	2	2026-07-30 11:12:42.832919+05:30	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
4	PR-2026-0004	3	Annual endpoint security licences	Annual endpoint security licences required for scheduled it & systems work.	IT Vendors	450.00	Licences	54000.00	USD	2026-07-28	Medium	IT & Systems	Replenishment against the approved annual operating plan.	Approved	3	2	2026-07-22 11:12:42.832955+05:30	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
5	PR-2026-0005	2	Palletised freight, EU lane	Palletised freight, EU lane required for scheduled logistics work.	Logistics Partners	220.00	Shipments	38900.00	USD	2026-10-07	High	Logistics	Replenishment against the approved annual operating plan.	Ordered	4	2	2026-08-02 11:12:42.832985+05:30	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
6	PR-2026-0006	3	Industrial polymer pellets	Industrial polymer pellets required for scheduled production work.	Raw Material Suppliers	18.00	Tonnes	41200.00	USD	2026-09-01	Medium	Production	Replenishment against the approved annual operating plan.	Ordered	1	2	2026-08-13 11:12:42.833012+05:30	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
7	PR-2026-0007	2	Quarterly HVAC servicing	Quarterly HVAC servicing required for scheduled facilities work.	Maintenance Vendors	4.00	Visits	9600.00	USD	2026-07-25	Low	Facilities	Replenishment against the approved annual operating plan.	Delivered	6	2	2026-08-21 11:12:42.833041+05:30	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
8	PR-2026-0008	3	Site cleaning contract renewal	Site cleaning contract renewal required for scheduled facilities work.	Service Providers	12.00	Months	28800.00	USD	2026-06-21	Low	Facilities	Replenishment against the approved annual operating plan.	Completed	5	2	2026-07-28 11:12:42.833068+05:30	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
9	PR-2026-0009	2	Forklift battery replacements	Forklift battery replacements required for scheduled warehouse work.	Equipment Vendors	14.00	Units	16800.00	USD	2026-07-28	Medium	Warehouse	Replenishment against the approved annual operating plan.	Rejected	\N	\N	\N	Budget not available in the current quarter; resubmit in Q3.	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
10	PR-2026-0010	3	Network switch refresh	Network switch refresh required for scheduled it & systems work.	IT Vendors	26.00	Units	31200.00	USD	2026-05-08	High	IT & Systems	Replenishment against the approved annual operating plan.	Cancelled	3	\N	\N	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
13	PR-2026-0013	3	Hydraulic press seals	Replacement seal kits for press line 2	Maintenance Vendors	60.00	Kits	7200.00	USD	2026-10-17	High	Maintenance	\N	Completed	6	2	2026-09-02 18:46:25.873713+05:30	\N	2026-09-02 18:46:25.742573+05:30	2026-09-02 18:46:26.12242+05:30
11	PR-2026-0011	3	Hydraulic press seals	Replacement seal kits for press line 2	Maintenance Vendors	60.00	Kits	7200.00	USD	2026-10-17	High	Maintenance	\N	Completed	6	2	2026-09-02 11:15:10.827378+05:30	\N	2026-09-02 11:15:10.661444+05:30	2026-09-02 11:15:11.127259+05:30
12	PR-2026-0012	3	Hydraulic press seals	Replacement seal kits for press line 2	Maintenance Vendors	60.00	Kits	7200.00	USD	2026-10-17	High	Maintenance	\N	Completed	6	2	2026-09-02 18:44:54.689386+05:30	\N	2026-09-02 18:44:54.617344+05:30	2026-09-02 18:44:54.883817+05:30
14	PR-2026-0014	3	Hydraulic press seals	Replacement seal kits for press line 2	Maintenance Vendors	60.00	Kits	7200.00	USD	2026-10-17	High	Maintenance	\N	Completed	6	2	2026-09-02 18:50:30.082782+05:30	\N	2026-09-02 18:50:30.03047+05:30	2026-09-02 18:50:30.269431+05:30
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_order_items (id, purchase_order_id, item_name, description, quantity, unit, unit_price, line_total) FROM stdin;
1	1	Palletised freight, EU lane	Palletised freight, EU lane required for scheduled logistics work.	220.00	Shipments	176.82	38900.40
2	2	Industrial polymer pellets	Industrial polymer pellets required for scheduled production work.	18.00	Tonnes	2288.89	41200.02
3	3	Quarterly HVAC servicing	Quarterly HVAC servicing required for scheduled facilities work.	4.00	Visits	2400.00	9600.00
4	4	Site cleaning contract renewal	Site cleaning contract renewal required for scheduled facilities work.	12.00	Months	2400.00	28800.00
5	5	Seal kit A	\N	40.00	Kits	120.00	4800.00
6	5	Seal kit B	\N	20.00	Kits	114.00	2280.00
7	6	Seal kit A	\N	40.00	Kits	120.00	4800.00
8	6	Seal kit B	\N	20.00	Kits	114.00	2280.00
9	7	Seal kit A	\N	40.00	Kits	120.00	4800.00
10	7	Seal kit B	\N	20.00	Kits	114.00	2280.00
11	8	Seal kit A	\N	40.00	Kits	120.00	4800.00
12	8	Seal kit B	\N	20.00	Kits	114.00	2280.00
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, po_number, vendor_id, procurement_request_id, created_by, title, description, order_date, expected_delivery, actual_delivery, currency, subtotal, tax_amount, shipping_amount, total_amount, payment_terms, shipping_address, notes, status, approved_by, approved_at, created_at, updated_at) FROM stdin;
1	PO-2026-0001	4	5	2	Palletised freight, EU lane	Purchase order raised against PR-2026-0005.	2026-07-12	2026-07-26	\N	USD	38900.40	3112.03	620.00	42632.43	Net 60	Plant 2, 14 Harbour Road, Rotterdam	\N	Ordered	2	2026-06-13 11:12:42.876318+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
2	PO-2026-0002	1	6	2	Industrial polymer pellets	Purchase order raised against PR-2026-0006.	2026-05-15	2026-06-10	\N	USD	41200.02	3296.00	250.00	44746.02	Net 45	Plant 2, 14 Harbour Road, Rotterdam	\N	Approved	2	2026-06-22 11:12:42.932919+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
3	PO-2026-0003	6	7	2	Quarterly HVAC servicing	Purchase order raised against PR-2026-0007.	2026-05-22	2026-06-30	2026-07-02	USD	9600.00	768.00	900.00	11268.00	Net 45	Plant 2, 14 Harbour Road, Rotterdam	\N	Delivered	2	2026-06-29 11:12:43.039259+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
4	PO-2026-0004	5	8	2	Site cleaning contract renewal	Purchase order raised against PR-2026-0008.	2026-05-30	2026-06-21	2026-06-23	USD	28800.00	2304.00	900.00	32004.00	Net 30	Plant 2, 14 Harbour Road, Rotterdam	\N	Completed	2	2026-07-09 11:12:43.045092+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
5	PO-2026-0005	6	11	2	Hydraulic press seals	\N	2026-09-02	2026-10-02	2026-10-09	USD	7080.00	576.00	240.00	7896.00	Net 30	\N	\N	Completed	2	2026-09-02 11:15:11.040301+05:30	2026-09-02 11:15:10.912531+05:30	2026-09-02 11:15:11.127259+05:30
6	PO-2026-0006	6	12	2	Hydraulic press seals	\N	2026-09-02	2026-10-02	2026-10-09	USD	7080.00	576.00	240.00	7896.00	Net 30	\N	\N	Completed	2	2026-09-02 18:44:54.831269+05:30	2026-09-02 18:44:54.748281+05:30	2026-09-02 18:44:54.883817+05:30
7	PO-2026-0007	6	13	2	Hydraulic press seals	\N	2026-09-02	2026-10-02	2026-10-09	USD	7080.00	576.00	240.00	7896.00	Net 30	\N	\N	Completed	2	2026-09-02 18:46:26.056802+05:30	2026-09-02 18:46:25.958047+05:30	2026-09-02 18:46:26.12242+05:30
8	PO-2026-0008	6	14	2	Hydraulic press seals	\N	2026-09-02	2026-10-02	2026-10-09	USD	7080.00	576.00	240.00	7896.00	Net 30	\N	\N	Completed	2	2026-09-02 18:50:30.207398+05:30	2026-09-02 18:50:30.140443+05:30	2026-09-02 18:50:30.269431+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, role, phone, department, job_title, vendor_id, is_active, last_login_at, created_at, updated_at) FROM stdin;
7	Clara Beaumont	meridian@vendor.vendoriq.com	$2b$12$C6PgLDi5/bNYCYrL1f2tJezoMkUqPOEkGDLX3iuPlxrun5nJMspRC	Vendor	+33 1 4555 0198	Vendor Portal	Account Manager	2	t	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
8	Devon Park	arclight@vendor.vendoriq.com	$2b$12$zeso8gKHPMM0Afr1GUnkwOeSEvJjEWxxsyYU8XhdBF3TejRMSbOli	Vendor	+1 415 555 0177	Vendor Portal	Account Manager	3	t	\N	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
3	Sofia Ramirez	supplychain@vendoriq.com	$2b$12$kRcOR7b8nTylxdB50KfNp.mYpIINo4kQT7FgLcWgPNj3gYJoLk/6O	Supply Chain Manager	+1 555 0156	Supply Chain	Supply Chain Manager	\N	t	2026-09-02 18:50:28.749597+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 18:50:28.528092+05:30
4	Ravi Krishnan	finance@vendoriq.com	$2b$12$OWos985yWGVtxBHk9BMJIu5CG51KHNWhKZZFAhDqT8PL7JYuzOzFO	Finance Officer	+1 555 0112	Finance	Finance Officer	\N	t	2026-09-02 18:50:28.9549+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 18:50:28.755089+05:30
5	Helen Brandt	auditor@vendoriq.com	$2b$12$YZCt7kkBS79NTkjfdx/KRuG7cpo10o5sXZD64PwjMStfnpSRC9y72	Auditor	+1 555 0182	Risk & Compliance	Internal Auditor	\N	t	2026-09-02 18:50:29.894569+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-02 18:50:29.681526+05:30
1	Amara Okonkwo	admin@vendoriq.com	$2b$12$968opm2apgZ2yuj3.3ogIuEAWzio6XaL95QNZ3IjIcUFUqeeaewRW	Administrator	+1 555 0145	IT & Systems	Platform Administrator	\N	t	2026-09-03 18:14:11.149945+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-03 18:14:10.580364+05:30
6	Jonas Lindqvist	northwind@vendor.vendoriq.com	$2b$12$JX6QyWAGfluG5ZMqoGEPS.XA/RAYyqxIcXWG.i5vC67OLTz4TF9ge	Vendor	+46 8 555 0142	Vendor Portal	Account Manager	1	t	2026-09-03 18:16:20.876654+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-03 18:16:20.201932+05:30
2	David Mwangi	procurement@vendoriq.com	$2b$12$39Q4fUI.h3IATWdSlSsqA.NaWP7db2pfnG7WP0eRyqL.6OdaG4wm6	Procurement Manager	+1 555 0188	Procurement	Head of Procurement	\N	t	2026-09-03 18:16:38.731766+05:30	2026-09-02 11:12:41.05493+05:30	2026-09-03 18:16:38.13256+05:30
\.


--
-- Data for Name: vendor_approvals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_approvals (id, vendor_id, action, previous_status, new_status, performed_by, comments, created_at) FROM stdin;
1	1	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
2	1	Approved	Pending	Approved	2	Documentation verified, vendor onboarded	2026-09-02 11:12:41.05493+05:30
3	2	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
4	2	Approved	Pending	Approved	2	Documentation verified, vendor onboarded	2026-09-02 11:12:41.05493+05:30
5	3	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
6	3	Approved	Pending	Approved	2	Documentation verified, vendor onboarded	2026-09-02 11:12:41.05493+05:30
7	4	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
8	4	Approved	Pending	Approved	2	Documentation verified, vendor onboarded	2026-09-02 11:12:41.05493+05:30
9	5	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
10	5	Approved	Pending	Approved	2	Documentation verified, vendor onboarded	2026-09-02 11:12:41.05493+05:30
11	6	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
12	6	Approved	Pending	Approved	2	Documentation verified, vendor onboarded	2026-09-02 11:12:41.05493+05:30
13	7	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
14	7	Approved	Pending	Approved	2	Documentation verified, vendor onboarded	2026-09-02 11:12:41.05493+05:30
15	8	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
16	9	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
17	10	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
18	10	Suspended	Approved	Suspended	2	Repeated delivery failures across three orders	2026-09-02 11:12:41.05493+05:30
19	11	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:12:41.05493+05:30
20	11	Rejected	Pending	Rejected	2	Failed financial due diligence: unresolved insolvency filing	2026-09-02 11:12:41.05493+05:30
21	12	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 11:15:10.480701+05:30
22	12	Approved	Pending	Approved	2	Documents verified	2026-09-02 11:15:10.573214+05:30
23	12	Suspended	Approved	Suspended	2	Pending re-audit	2026-09-02 11:15:10.601379+05:30
24	12	Reactivated	Suspended	Approved	2	\N	2026-09-02 11:15:10.610352+05:30
25	13	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 18:44:54.438121+05:30
26	13	Approved	Pending	Approved	2	Documents verified	2026-09-02 18:44:54.522022+05:30
27	13	Suspended	Approved	Suspended	2	Pending re-audit	2026-09-02 18:44:54.546583+05:30
28	13	Reactivated	Suspended	Approved	2	\N	2026-09-02 18:44:54.557448+05:30
29	14	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 18:46:25.500692+05:30
30	14	Approved	Pending	Approved	2	Documents verified	2026-09-02 18:46:25.58581+05:30
31	14	Suspended	Approved	Suspended	2	Pending re-audit	2026-09-02 18:46:25.625834+05:30
32	14	Reactivated	Suspended	Approved	2	\N	2026-09-02 18:46:25.644123+05:30
33	15	Submitted	\N	Pending	2	Vendor registration submitted for approval	2026-09-02 18:50:29.937184+05:30
34	15	Approved	Pending	Approved	2	Documents verified	2026-09-02 18:50:29.964954+05:30
35	15	Suspended	Approved	Suspended	2	Pending re-audit	2026-09-02 18:50:29.982516+05:30
36	15	Reactivated	Suspended	Approved	2	\N	2026-09-02 18:50:29.991214+05:30
\.


--
-- Data for Name: vendor_certifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_certifications (id, vendor_id, certification_name, issuing_authority, certificate_number, issue_date, expiry_date, status, document_path, created_at) FROM stdin;
1	1	ISO/IEC 27001 Information Security	DNV	CERT-85401	2024-12-07	2027-12-07	Valid	\N	2026-09-02 11:12:41.05493+05:30
2	1	ISO 9001:2015 Quality Management	BSI Group	CERT-91879	2025-09-01	2028-08-31	Valid	\N	2026-09-02 11:12:41.05493+05:30
3	2	ISO 14001:2015 Environmental Management	TUV Rheinland	CERT-99476	2025-04-16	2028-04-15	Valid	\N	2026-09-02 11:12:41.05493+05:30
4	2	ISO/IEC 27001 Information Security	DNV	CERT-37692	2026-02-11	2029-02-10	Valid	\N	2026-09-02 11:12:41.05493+05:30
5	3	ISO 14001:2015 Environmental Management	TUV Rheinland	CERT-38333	2024-12-29	2027-12-29	Valid	\N	2026-09-02 11:12:41.05493+05:30
6	3	ISO 9001:2015 Quality Management	BSI Group	CERT-31496	2025-12-20	2028-12-19	Valid	\N	2026-09-02 11:12:41.05493+05:30
7	4	ISO 14001:2015 Environmental Management	TUV Rheinland	CERT-78941	2024-07-09	2027-07-09	Valid	\N	2026-09-02 11:12:41.05493+05:30
8	4	ISO 9001:2015 Quality Management	BSI Group	CERT-71884	2024-07-12	2027-07-12	Valid	\N	2026-09-02 11:12:41.05493+05:30
9	5	ISO 45001 Occupational Health & Safety	SGS	CERT-75579	2024-04-18	2027-04-18	Valid	\N	2026-09-02 11:12:41.05493+05:30
10	5	ISO/IEC 27001 Information Security	DNV	CERT-31452	2025-08-25	2028-08-24	Valid	\N	2026-09-02 11:12:41.05493+05:30
11	6	ISO 14001:2015 Environmental Management	TUV Rheinland	CERT-69054	2025-04-25	2028-04-24	Valid	\N	2026-09-02 11:12:41.05493+05:30
12	6	ISO 45001 Occupational Health & Safety	SGS	CERT-63845	2025-10-04	2028-10-03	Valid	\N	2026-09-02 11:12:41.05493+05:30
13	7	ISO 14001:2015 Environmental Management	TUV Rheinland	CERT-95536	2025-11-24	2028-11-23	Valid	\N	2026-09-02 11:12:41.05493+05:30
14	7	ISO/IEC 27001 Information Security	DNV	CERT-49225	2025-07-03	2028-07-02	Valid	\N	2026-09-02 11:12:41.05493+05:30
15	6	ISO 45001 Occupational Health & Safety	SGS	\N	2026-08-03	2029-05-29	Valid	\N	2026-09-02 11:15:11.81469+05:30
16	6	ISO 45001 Occupational Health & Safety	SGS	\N	2026-08-03	2029-05-29	Valid	\N	2026-09-02 18:44:55.358663+05:30
17	6	ISO 45001 Occupational Health & Safety	SGS	\N	2026-08-03	2029-05-29	Valid	\N	2026-09-02 18:46:26.486075+05:30
18	6	ISO 45001 Occupational Health & Safety	SGS	\N	2026-08-03	2029-05-29	Valid	\N	2026-09-02 18:50:30.571701+05:30
\.


--
-- Data for Name: vendor_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_contacts (id, vendor_id, name, designation, email, phone, is_primary, created_at) FROM stdin;
1	1	Jonas Lindqvist	Account Manager	orders@northwindsteel.com	+46 8 555 0142	t	2026-09-02 11:12:41.05493+05:30
2	2	Clara Beaumont	Account Manager	sales@meridiantools.com	+33 1 4555 0198	t	2026-09-02 11:12:41.05493+05:30
3	3	Devon Park	Account Manager	accounts@arclightsys.com	+1 415 555 0177	t	2026-09-02 11:12:41.05493+05:30
4	4	Ana Sousa	Account Manager	dispatch@kestrellog.com	+351 21 555 0163	t	2026-09-02 11:12:41.05493+05:30
5	5	Mark Ellery	Account Manager	hello@vantagefs.com	+44 20 7555 0121	t	2026-09-02 11:12:41.05493+05:30
6	6	Priya Nair	Account Manager	service@ironcladmc.com	+91 22 5550 0134	t	2026-09-02 11:12:41.05493+05:30
7	7	Tomas Weber	Account Manager	supply@cobaltpoly.de	+49 89 5550 0155	t	2026-09-02 11:12:41.05493+05:30
8	8	Grace Adeyemi	Account Manager	ops@halcyonfreight.com	+234 1 555 0188	t	2026-09-02 11:12:41.05493+05:30
9	9	Ito Nakamura	Account Manager	biz@quantumcloud.jp	+81 3 5550 0116	t	2026-09-02 11:12:41.05493+05:30
10	10	Lucas Ferreira	Account Manager	rentals@summitind.br	+55 11 5550 0172	t	2026-09-02 11:12:41.05493+05:30
11	11	Nadia Fahmy	Account Manager	contact@brightlinec.com	+20 2 5550 0109	t	2026-09-02 11:12:41.05493+05:30
12	12	Elena Petrova	Sales Lead	sales@auroracomp.test	\N	t	2026-09-02 11:15:10.480701+05:30
13	13	Elena Petrova	Sales Lead	sales@auroracomp.test	\N	t	2026-09-02 18:44:54.438121+05:30
14	14	Elena Petrova	Sales Lead	sales@auroracomp.test	\N	t	2026-09-02 18:46:25.500692+05:30
15	15	Elena Petrova	Sales Lead	sales@auroracomp.test	\N	t	2026-09-02 18:50:29.937184+05:30
\.


--
-- Data for Name: vendor_performance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_performance (id, vendor_id, purchase_order_id, evaluation_date, on_time_delivery, delayed_delivery, quality_rating, response_time, issue_resolution_time, order_completion_rate, service_rating, remarks, created_at) FROM stdin;
1	6	3	2026-07-02	0.00	100.00	4.27	18.52	30.04	89.04	3.77	Delivered 2 day(s) late	2026-09-02 11:12:41.05493+05:30
2	5	4	2026-06-23	0.00	100.00	4.50	25.68	25.60	91.95	3.16	Delivered 2 day(s) late	2026-09-02 11:12:41.05493+05:30
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendors (id, vendor_code, vendor_name, category, contact_person, email, phone, website, address, city, country, tax_id, registration_number, status, risk_level, reliability_score, approved_by, approved_at, rejection_reason, onboarded_on, notes, created_by, created_at, updated_at) FROM stdin;
1	VND-0001	Northwind Steel Works	Raw Material Suppliers	Jonas Lindqvist	orders@northwindsteel.com	+46 8 555 0142	https://www.northwindsteel.com	46 Industrial Estate	Gothenburg	Sweden	TAX974163	REG664597	Approved	Low	92.40	2	2026-07-17 11:12:42.170324+05:30	\N	2025-05-10	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
2	VND-0002	Meridian Precision Tools	Equipment Vendors	Clara Beaumont	sales@meridiantools.com	+33 1 4555 0198	https://www.meridiantools.com	318 Industrial Estate	Lyon	France	TAX829471	REG569321	Approved	Low	88.10	2	2025-04-06 11:12:42.170396+05:30	\N	2024-06-18	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
3	VND-0003	Arclight Systems	IT Vendors	Devon Park	accounts@arclightsys.com	+1 415 555 0177	https://www.arclightsys.com	235 Industrial Estate	San Jose	United States	TAX832822	REG858612	Approved	Medium	79.60	2	2025-09-18 11:12:42.170438+05:30	\N	2025-01-25	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
4	VND-0004	Kestrel Logistics Group	Logistics Partners	Ana Sousa	dispatch@kestrellog.com	+351 21 555 0163	https://www.kestrellog.com	280 Industrial Estate	Lisbon	Portugal	TAX307064	REG592507	Approved	Medium	74.30	2	2026-02-09 11:12:42.170468+05:30	\N	2024-07-27	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
5	VND-0005	Vantage Facility Services	Service Providers	Mark Ellery	hello@vantagefs.com	+44 20 7555 0121	https://www.vantagefs.com	270 Industrial Estate	Manchester	United Kingdom	TAX212454	REG168003	Approved	Low	85.90	2	2026-01-15 11:12:42.170502+05:30	\N	2026-04-02	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
6	VND-0006	Ironclad Maintenance Co.	Maintenance Vendors	Priya Nair	service@ironcladmc.com	+91 22 5550 0134	https://www.ironcladmc.com	193 Industrial Estate	Pune	India	TAX459794	REG503222	Approved	High	61.20	2	2025-04-03 11:12:42.170531+05:30	\N	2025-04-14	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
7	VND-0007	Cobalt Polymer Supply	Raw Material Suppliers	Tomas Weber	supply@cobaltpoly.de	+49 89 5550 0155	https://www.cobaltpoly.de	326 Industrial Estate	Munich	Germany	TAX724983	REG799623	Approved	Medium	81.70	2	2025-12-16 11:12:42.170562+05:30	\N	2024-05-22	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
8	VND-0008	Halcyon Freight Partners	Logistics Partners	Grace Adeyemi	ops@halcyonfreight.com	+234 1 555 0188	https://www.halcyonfreight.com	162 Industrial Estate	Lagos	Nigeria	TAX526284	REG903543	Pending	Medium	\N	\N	\N	\N	\N	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
9	VND-0009	Quantum Cloud Networks	IT Vendors	Ito Nakamura	biz@quantumcloud.jp	+81 3 5550 0116	https://www.quantumcloud.jp	160 Industrial Estate	Osaka	Japan	TAX353328	REG431287	Pending	Medium	\N	\N	\N	\N	\N	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
10	VND-0010	Summit Industrial Rentals	Equipment Vendors	Lucas Ferreira	rentals@summitind.br	+55 11 5550 0172	https://www.summitind.br	216 Industrial Estate	Sao Paulo	Brazil	TAX863279	REG205758	Suspended	High	48.50	\N	\N	\N	\N	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
11	VND-0011	Bright Line Consulting	Service Providers	Nadia Fahmy	contact@brightlinec.com	+20 2 5550 0109	https://www.brightlinec.com	186 Industrial Estate	Cairo	Egypt	TAX756150	REG134790	Rejected	Critical	\N	\N	\N	Failed financial due diligence: unresolved insolvency filing	\N	\N	2	2026-09-02 11:12:41.05493+05:30	2026-09-02 11:12:41.05493+05:30
12	VND-0012	Aurora Components Ltd	Equipment Vendors	Elena Petrova	sales@auroracomp.test	+372 5555 0100	\N	\N	Tallinn	Estonia	\N	\N	Approved	Medium	\N	2	2026-09-02 11:15:10.612101+05:30	\N	2026-09-02	\N	2	2026-09-02 11:15:10.480701+05:30	2026-09-02 11:15:10.610352+05:30
13	VND-0013	Aurora Components Ltd	Equipment Vendors	Elena Petrova	sales@auroracomp.test	+372 5555 0100	\N	\N	Tallinn	Estonia	\N	\N	Approved	Medium	\N	2	2026-09-02 18:44:54.559257+05:30	\N	2026-09-02	\N	2	2026-09-02 18:44:54.438121+05:30	2026-09-02 18:44:54.557448+05:30
14	VND-0014	Aurora Components Ltd	Equipment Vendors	Elena Petrova	sales@auroracomp.test	+372 5555 0100	\N	\N	Tallinn	Estonia	\N	\N	Approved	Medium	\N	2	2026-09-02 18:46:25.647294+05:30	\N	2026-09-02	\N	2	2026-09-02 18:46:25.500692+05:30	2026-09-02 18:46:25.644123+05:30
15	VND-0015	Aurora Components Ltd	Equipment Vendors	Elena Petrova	sales@auroracomp.test	+372 5555 0100	\N	\N	Tallinn	Estonia	\N	\N	Approved	Medium	\N	2	2026-09-02 18:50:29.993562+05:30	\N	2026-09-02	\N	2	2026-09-02 18:50:29.937184+05:30	2026-09-02 18:50:29.991214+05:30
\.


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 93, true);


--
-- Name: compliance_checks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.compliance_checks_id_seq', 15, true);


--
-- Name: contracts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.contracts_id_seq', 15, true);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoices_id_seq', 6, true);


--
-- Name: message_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.message_attachments_id_seq', 1, false);


--
-- Name: message_threads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.message_threads_id_seq', 8, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 16, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 81, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 4, true);


--
-- Name: procurement_approvals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.procurement_approvals_id_seq', 29, true);


--
-- Name: procurement_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.procurement_requests_id_seq', 14, true);


--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_order_items_id_seq', 12, true);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_orders_id_seq', 8, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 8, true);


--
-- Name: vendor_approvals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendor_approvals_id_seq', 36, true);


--
-- Name: vendor_certifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendor_certifications_id_seq', 18, true);


--
-- Name: vendor_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendor_contacts_id_seq', 15, true);


--
-- Name: vendor_performance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendor_performance_id_seq', 2, true);


--
-- Name: vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendors_id_seq', 15, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: compliance_checks compliance_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_checks
    ADD CONSTRAINT compliance_checks_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_key UNIQUE (contract_number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- Name: message_threads message_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: procurement_approvals procurement_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_approvals
    ADD CONSTRAINT procurement_approvals_pkey PRIMARY KEY (id);


--
-- Name: procurement_requests procurement_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_requests
    ADD CONSTRAINT procurement_requests_pkey PRIMARY KEY (id);


--
-- Name: procurement_requests procurement_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_requests
    ADD CONSTRAINT procurement_requests_request_number_key UNIQUE (request_number);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_approvals vendor_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_approvals
    ADD CONSTRAINT vendor_approvals_pkey PRIMARY KEY (id);


--
-- Name: vendor_certifications vendor_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_certifications
    ADD CONSTRAINT vendor_certifications_pkey PRIMARY KEY (id);


--
-- Name: vendor_contacts vendor_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_contacts
    ADD CONSTRAINT vendor_contacts_pkey PRIMARY KEY (id);


--
-- Name: vendor_performance vendor_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_performance
    ADD CONSTRAINT vendor_performance_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_vendor_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_vendor_code_key UNIQUE (vendor_code);


--
-- Name: idx_activity_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_contracts_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_expiry ON public.contracts USING btree (expiry_date);


--
-- Name: idx_contracts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_status ON public.contracts USING btree (status);


--
-- Name: idx_messages_thread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_thread ON public.messages USING btree (thread_id);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_po_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_po_status ON public.purchase_orders USING btree (status);


--
-- Name: idx_po_vendor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_po_vendor ON public.purchase_orders USING btree (vendor_id);


--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_status ON public.procurement_requests USING btree (status);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_vendors_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_category ON public.vendors USING btree (category);


--
-- Name: idx_vendors_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_status ON public.vendors USING btree (status);


--
-- Name: activity_logs fk_activity_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: vendor_approvals fk_approval_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_approvals
    ADD CONSTRAINT fk_approval_user FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: vendor_approvals fk_approval_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_approvals
    ADD CONSTRAINT fk_approval_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: message_attachments fk_attachment_message; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT fk_attachment_message FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: vendor_certifications fk_certification_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_certifications
    ADD CONSTRAINT fk_certification_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: compliance_checks fk_compliance_contract; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_checks
    ADD CONSTRAINT fk_compliance_contract FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: compliance_checks fk_compliance_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_checks
    ADD CONSTRAINT fk_compliance_user FOREIGN KEY (checked_by) REFERENCES public.users(id);


--
-- Name: compliance_checks fk_compliance_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_checks
    ADD CONSTRAINT fk_compliance_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendor_contacts fk_contact_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_contacts
    ADD CONSTRAINT fk_contact_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: contracts fk_contract_owner; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT fk_contract_owner FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: contracts fk_contract_renewed_from; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT fk_contract_renewed_from FOREIGN KEY (renewed_from_id) REFERENCES public.contracts(id);


--
-- Name: contracts fk_contract_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT fk_contract_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: invoices fk_invoice_po; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoice_po FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: invoices fk_invoice_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoice_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: messages fk_message_sender; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: messages fk_message_thread; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_message_thread FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE CASCADE;


--
-- Name: notifications fk_notification_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vendor_performance fk_performance_purchase_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_performance
    ADD CONSTRAINT fk_performance_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: vendor_performance fk_performance_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_performance
    ADD CONSTRAINT fk_performance_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: purchase_orders fk_po_approver; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_po_approver FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: purchase_orders fk_po_creator; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_po_creator FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: purchase_order_items fk_po_item_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT fk_po_item_order FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders fk_po_request; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_po_request FOREIGN KEY (procurement_request_id) REFERENCES public.procurement_requests(id);


--
-- Name: purchase_orders fk_po_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: procurement_approvals fk_proc_approval_request; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_approvals
    ADD CONSTRAINT fk_proc_approval_request FOREIGN KEY (request_id) REFERENCES public.procurement_requests(id) ON DELETE CASCADE;


--
-- Name: procurement_approvals fk_proc_approval_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_approvals
    ADD CONSTRAINT fk_proc_approval_user FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: procurement_requests fk_procurement_approver; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_requests
    ADD CONSTRAINT fk_procurement_approver FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: procurement_requests fk_procurement_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_requests
    ADD CONSTRAINT fk_procurement_user FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: procurement_requests fk_procurement_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_requests
    ADD CONSTRAINT fk_procurement_vendor FOREIGN KEY (assigned_vendor_id) REFERENCES public.vendors(id);


--
-- Name: password_reset_tokens fk_reset_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: message_threads fk_thread_contract; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT fk_thread_contract FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: message_threads fk_thread_creator; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT fk_thread_creator FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: message_threads fk_thread_po; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT fk_thread_po FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: message_threads fk_thread_request; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT fk_thread_request FOREIGN KEY (procurement_request_id) REFERENCES public.procurement_requests(id) ON DELETE SET NULL;


--
-- Name: message_threads fk_thread_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT fk_thread_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: users fk_user_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_user_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: vendors fk_vendor_approver; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT fk_vendor_approver FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: vendors fk_vendor_creator; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT fk_vendor_creator FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict U6bGQRfVqGuyAhVyjl46iExqdnYK3TQt8V4GlSFcpXZrbxsGi6WDY69I4nm1fus

