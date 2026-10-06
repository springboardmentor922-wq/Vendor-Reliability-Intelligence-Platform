# Project Objectives & Vision

## 1. Executive Summary
The **Vendor Reliability Intelligence & Procurement Risk Management Platform** is designed to solve critical challenges faced by enterprise supply chain and procurement divisions. Organizations frequently suffer from supply delays, unverified supplier credentials, fragmented order management, manual compliance checking, and lack of objective vendor reliability metrics.

This platform unifies procurement workflows, supplier management, and predictive reliability analytics into a centralized web portal.

---

## 2. High-Level Objectives

### 2.1 Core Mission
To provide an end-to-end intelligence ecosystem where organizations can:
* Evaluate, onboard, and audit vendors seamlessly.
* Track purchase order lifecycles and delivery fulfillments in real time.
* Mitigate supply chain risks using automated reliability scoring and data-driven insights.
* Enforce strict role-based governance across procurement officers, finance managers, supply chain teams, auditors, and vendors.

### 2.2 Milestone 1 Objectives
1. **System Architecture Foundation:** Establish a scalable, maintainable modular structure separating the Python FastAPI backend and Angular single-page frontend.
2. **Database & Persistence:** Design and implement a robust relational database schema starting with user role administration, password security, and JWT tokens.
3. **Security Architecture:** Implement OAuth2 / JWT authentication with secure password hashing (`bcrypt`), CORS security, input validation, and environment configuration.
4. **User Role Management:** Lay down the groundwork for 6 user roles (`ADMINISTRATOR`, `PROCUREMENT_MANAGER`, `SUPPLY_CHAIN_MANAGER`, `VENDOR`, `FINANCE_OFFICER`, `AUDITOR`).
5. **Modern User Experience:** Develop a responsive, clean, professional Angular Material interface featuring real-time state management, navigation layout, authentication screens, dynamic dashboard, and clear placeholder components for future milestone modules.

---

## 3. Future Milestone Roadmap (Contextual Horizon)

* **Milestone 2 (Procurement & Supplier Operations):**
  * Vendor onboarding & profiles CRUD
  * Vendor approval workflow
  * Purchase order issuance & status tracking
  * Contract repository & document attachment
  * Real-time notification system

* **Milestone 3 (Reliability Analytics & Intelligence):**
  * Vendor reliability scoring engine (on-time delivery %, quality index, risk rating)
  * AI/ML predictive delivery delay model
  * Analytical dashboards & custom reporting (PDF/Excel generation)
  * Automated compliance audit logs
