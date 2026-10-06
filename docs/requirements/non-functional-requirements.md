# Non-Functional Requirements Specification

## 1. Quantitative Performance & Future Scalability Targets

> [!NOTE]
> The performance metrics listed below represent the platform's architectural design goals for full production deployment (Milestones 2 & 3). In Milestone 1, performance baseline is established.

* **API Response Time Target:** < 300 ms for 95% of read/write REST endpoints under standard load.
* **Dashboard Initial Load Target:** < 2.0 seconds complete page interactive paint (FCP / TTI).
* **System Concurrency Goal:** Scalable architecture to support 1,000+ active concurrent users without degraded response latency.

---

## 2. Security Requirements

* **Password Protection:** Mandatory hashing using `bcrypt` (work factor 12). Plaintext passwords must never touch logs or persist in database storage.
* **Stateless JWT Tokens:** OAuth2 Bearer pattern with HS256 / RS256 signature, environment-configured secret key, and configurable expiration timeout (default 60 minutes).
* **CORS Governance:** Strict Origin control restricting API access to authorized frontend domains (`http://localhost:4200` in dev).
* **Input Validation:** Strict Pydantic models on backend endpoints to guard against SQL injection, payload manipulation, and malformed requests.
* **Client-Side Auth Guards:** Angular CanActivate route guards preventing unauthenticated client-side navigation.

---

## 3. Database Reliability & Maintainability

* **ACID Transactions:** Full database transactional consistency backed by PostgreSQL and SQLAlchemy 2.0 ORM.
* **Database Migrations:** Schema changes managed via Alembic versioned migration scripts.
* **Clean Code Architecture:** Strict separation of concerns (Models, Schemas, Routers, Services, Dependencies).

---

## 4. UI Usability & Accessibility

* **Responsive Design:** Adaptive layout supporting Desktop (>1200px), Tablet (768px - 1199px), and Mobile (<767px) screens.
* **Design Aesthetics:** Modern typography, high-contrast dark accent themes, clear visual feedback, error alert banners, and Angular Material component integration.
