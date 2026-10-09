# VendorIQ

Predictive Vendor Reliability & Procurement Risk Management Platform.

VendorIQ is a full-stack enterprise web application that unifies supplier performance tracking, automated procurement lifecycles, and machine-learning-driven delivery delay forecasting across organizational roles.

---

## Project Demo Video

<!-- Drag & drop your .mp4 video into GitHub's README editor or link your video URL below -->
[![VendorIQ Demo Walkthrough](https://img.shields.io/badge/Demo%20Video-Watch%20Walkthrough-0f766e?style=for-the-badge&logo=youtube&logoColor=white)](#project-demo-video)

> **Watch the Complete Walkthrough:**
> _(Embed your video directly by dragging your `.mp4` file into GitHub's README editor or replace the link below with your video URL)_
> 
> ```html
> <video src="YOUR_VIDEO_URL_HERE.mp4" controls="controls" width="100%" style="border-radius: 8px;"></video>
> ```

---

## Features

- **Role-Based Access Control**: Tailored workflows and isolated views for Administrator, Procurement Manager, Supply Chain Lead, Vendor, Finance Officer, and Auditor.
- **Predictive Risk Engine**: Machine learning model forecasting supplier delivery delays before purchase orders are dispatched.
- **Reliability Scoring**: Composite supplier scoring (0-100) based on on-time delivery, product quality ratings, contract compliance, issue turnaround, and response times.
- **Procurement Lifecycle**: End-to-end requisitions, purchase order approval chains, line item tracking, and status progression.
- **Financial Settlements**: Three-way matching, invoice lifecycle management, and structured GST tax invoice PDF generation.
- **Audit & Governance**: Immutable activity logging, contract expiration monitoring, and cross-departmental operational messaging.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, Pure CSS Glassmorphism, Native SVG Charts |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy ORM, Pydantic v2, JWT Authentication |
| **Machine Learning** | Scikit-learn (Random Forest / Gradient Boosting), Joblib |
| **Database** | SQLite (local development) / PostgreSQL (production) |
| **Deployment** | Docker, Docker Compose, Nginx |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- (Optional) Docker and Docker Compose

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API Base URL: `http://localhost:8000`
- Interactive API Docs (Swagger): `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

- Web Application: `http://localhost:5173`

### 3. Docker Deployment (Alternative)

```bash
docker-compose up --build
```

---

## Demo Accounts

The database comes pre-seeded with sample accounts for testing:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@vendoriq.com` | `Admin@123` |
| Procurement Manager | `procurement@vendoriq.com` | `Procure@123` |
| Supply Chain Manager | `supplychain@vendoriq.com` | `Supply@123` |
| Vendor | `vendor@apexmaterials.com` | `Vendor@123` |
| Finance Officer | `finance@vendoriq.com` | `Finance@123` |
| Auditor | `auditor@vendoriq.com` | `Audit@123` |

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── core/           # Security, dependencies, and audit middleware
│   │   ├── models/         # SQLAlchemy database models
│   │   ├── routers/        # FastAPI route controllers
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── database.py     # Database engine and session configuration
│   │   └── main.py         # Application entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # UI components and interactive SVG charts
│   │   ├── context/        # Authentication and session state
│   │   ├── pages/          # Role dashboards and procurement views
│   │   └── services/       # API client
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## License

This project is licensed under the MIT License.
