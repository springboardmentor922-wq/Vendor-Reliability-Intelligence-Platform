--
-- PostgreSQL database dump
--

\restrict nvwMhZEhdczDRGxrz9Qv3qzQi29SB0dUR1iYU0fFvgpLcHSkEnGZadAgIoE2q9v

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    contract_number character varying(50) NOT NULL,
    start_date date NOT NULL,
    expiry_date date NOT NULL,
    contract_value numeric(15,2),
    compliance_status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    document_path text
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
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    notification_type character varying(50) NOT NULL,
    message text NOT NULL,
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
-- Name: procurement_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.procurement_requests (
    id bigint NOT NULL,
    request_number character varying(50) NOT NULL,
    requested_by bigint NOT NULL,
    item character varying(150) NOT NULL,
    description text,
    quantity numeric(12,2) NOT NULL,
    estimated_cost numeric(15,2),
    required_date date,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id bigint NOT NULL,
    po_number character varying(50) NOT NULL,
    vendor_id bigint NOT NULL,
    procurement_request_id bigint,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_delivery date,
    actual_delivery date,
    amount numeric(15,2),
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL
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
    role character varying(50) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
-- Name: vendor_performance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_performance (
    id bigint NOT NULL,
    vendor_id bigint NOT NULL,
    purchase_order_id bigint,
    on_time_delivery numeric(5,2),
    delayed_delivery numeric(5,2),
    quality_rating numeric(3,2),
    response_time numeric(10,2),
    issue_resolution_time numeric(10,2),
    order_completion_rate numeric(5,2)
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
    vendor_name character varying(150) NOT NULL,
    category character varying(100),
    email character varying(255),
    phone character varying(20),
    address text,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contracts (id, vendor_id, contract_number, start_date, expiry_date, contract_value, compliance_status, document_path) FROM stdin;
1	1	CON-001	2026-01-01	2026-12-31	750000.00	compliant	/documents/contracts/CON-001.pdf
2	2	CON-002	2026-02-01	2026-11-30	500000.00	compliant	/documents/contracts/CON-002.pdf
3	3	CON-003	2026-03-01	2026-10-31	300000.00	under_review	/documents/contracts/CON-003.pdf
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, notification_type, message, is_read, created_at) FROM stdin;
1	1	delivery_delay	PO-002 delivery is delayed by 2 days.	f	2026-08-30 12:06:47.036863+05:30
2	1	vendor_alert	Vendor 2 has a higher delayed delivery rate of 12%.	f	2026-08-30 12:06:47.036863+05:30
3	1	performance_update	Vendor performance data has been updated successfully.	t	2026-08-30 12:06:47.036863+05:30
\.


--
-- Data for Name: procurement_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.procurement_requests (id, request_number, requested_by, item, description, quantity, estimated_cost, required_date, status, created_at) FROM stdin;
1	REQ-001	1	Laptop Computers	Business laptops for procurement department	10.00	750000.00	2026-09-15	pending	2026-08-30 12:03:19.852022+05:30
2	REQ-002	1	Office Chairs	Ergonomic office chairs	25.00	125000.00	2026-09-20	approved	2026-08-30 12:03:19.852022+05:30
3	REQ-003	1	Network Equipment	Network switches and related equipment	5.00	200000.00	2026-09-25	pending	2026-08-30 12:03:19.852022+05:30
4	PR-001	1	Laptop	Development laptop	2.00	120000.00	2026-09-15	Pending	2026-09-01 09:58:56.732462+05:30
5	PR-004	1	Laptop	Development laptop	2.00	120000.00	2026-09-15	Pending	2026-09-02 09:54:21.475621+05:30
6	PR-0002	1	CNC Tool Holders	BT40 tool holders required for production	120.00	18400.00	2026-09-15	Pending	2026-09-02 10:22:42.929194+05:30
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, po_number, vendor_id, procurement_request_id, order_date, expected_delivery, actual_delivery, amount, status) FROM stdin;
1	PO-001	1	1	2026-08-30	2026-09-15	2026-09-14	750000.00	completed
2	PO-002	2	2	2026-08-30	2026-09-20	2026-09-22	125000.00	completed
3	PO-003	3	3	2026-08-30	2026-09-25	\N	200000.00	pending
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, role, is_active, created_at) FROM stdin;
1	Admin User	admin@example.com	test_password_hash	admin	t	2026-08-30 12:02:12.848112+05:30
\.


--
-- Data for Name: vendor_performance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendor_performance (id, vendor_id, purchase_order_id, on_time_delivery, delayed_delivery, quality_rating, response_time, issue_resolution_time, order_completion_rate) FROM stdin;
12	1	1	92.50	7.50	4.50	2.00	5.00	95.00
13	2	2	88.00	12.00	4.00	3.50	7.00	90.00
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendors (id, vendor_name, category, email, phone, address, status, created_at) FROM stdin;
2	Global Supplies Ltd	Industrial Supplies	global@example.com	9876543211	Bangalore	active	2026-08-30 01:52:11.651918+05:30
3	Reliable Components	Manufacturing	reliable@example.com	9876543212	Chennai	active	2026-08-30 01:52:11.651918+05:30
4	Prime Logistics	Logistics	prime@example.com	9876543213	Mumbai	active	2026-08-30 01:52:11.651918+05:30
5	Techno Solutions	IT Services	techno@example.com	9876543214	Pune	active	2026-08-30 01:52:11.651918+05:30
6	ABC Technologies	IT Services	abc@example.com	9876543210	Hyderabad	active	2026-08-30 11:13:50.782737+05:30
7	Global Supplies Ltd	Industrial Supplies	global@example.com	9876543211	Bangalore	active	2026-08-30 11:13:50.782737+05:30
8	Reliable Components	Manufacturing	reliable@example.com	9876543212	Chennai	active	2026-08-30 11:13:50.782737+05:30
9	Prime Logistics	Logistics	prime@example.com	9876543213	Mumbai	active	2026-08-30 11:13:50.782737+05:30
10	Techno Solutions	IT Services	techno@example.com	9876543214	Pune	active	2026-08-30 11:13:50.782737+05:30
11	string	string	string	string	string	Active	2026-08-30 17:02:23.682668+05:30
1	ABC Technologies	Raw Material Suppliers	abc@example.com	9876543210	Hyderabad	Active	2026-08-30 01:52:11.651918+05:30
\.


--
-- Name: contracts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.contracts_id_seq', 3, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 3, true);


--
-- Name: procurement_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.procurement_requests_id_seq', 6, true);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_orders_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: vendor_performance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendor_performance_id_seq', 13, true);


--
-- Name: vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vendors_id_seq', 11, true);


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
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


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
-- Name: contracts fk_contract_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT fk_contract_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: notifications fk_notification_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: vendor_performance fk_performance_purchase_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_performance
    ADD CONSTRAINT fk_performance_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: vendor_performance fk_performance_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_performance
    ADD CONSTRAINT fk_performance_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: procurement_requests fk_procurement_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.procurement_requests
    ADD CONSTRAINT fk_procurement_user FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: purchase_orders fk_purchase_order_request; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_purchase_order_request FOREIGN KEY (procurement_request_id) REFERENCES public.procurement_requests(id);


--
-- Name: purchase_orders fk_purchase_order_vendor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_purchase_order_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- PostgreSQL database dump complete
--

\unrestrict nvwMhZEhdczDRGxrz9Qv3qzQi29SB0dUR1iYU0fFvgpLcHSkEnGZadAgIoE2q9v

