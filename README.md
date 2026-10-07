# Vendor Intelligence - Vendor Reliability Intelligence Platform

A full-stack web application for managing vendors, procurement, purchase orders, contracts, invoices, vendor performance, reliability scoring, analytics, reports, notifications, and related supplier information.

## Live Deployment

### Frontend
https://vendor-iq.onrender.com

### Backend API
https://vendor-intelligence-deployment.onrender.com

### API Documentation
https://vendor-intelligence-deployment.onrender.com/docs

### Backend Health Check
https://vendor-intelligence-deployment.onrender.com/health

## Project Overview

The Vendor Intelligence Platform provides a centralized system for managing procurement and vendor-related activities. It supports role-based access and uses PostgreSQL for persistent application data.

The main procurement workflow is:

**Pending -> Approved -> Ordered -> Delivered -> Completed**

When a procurement reaches the Ordered stage, the system supports Purchase Order creation and management.

## Key Features

- User authentication and role-based access
- Vendor management
- Procurement management and approval workflow
- Purchase Order management
- Contract management
- Invoice management
- Vendor performance tracking
- Vendor reliability scoring
- Analytics dashboard
- Reports and data export
- PDF report export
- Excel report export
- Notifications
- Vendor communication management
- Vendor profile management
- Compliance and certification information

## User Roles

The application supports the following roles:

- Administrator
- Procurement Manager
- Supply Chain Manager
- Vendor
- Finance Officer
- Auditor

Access to application modules is controlled according to the user's role.

## Technology Stack

### Frontend

- React
- JavaScript
- Vite
- React Router
- Axios
- HTML5 / CSS3

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- JWT-based authentication
- Passlib / bcrypt for password hashing

### Database

- PostgreSQL
- psycopg2-binary

### Deployment

- GitHub
- Render Static Site - Frontend
- Render Web Service - Backend
- Render PostgreSQL - Database

## Project Structure

```text
vendor-intelligence-deployment/
│
├── Back/
│   ├── auth.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── seed_data.py
│   └── requirements.txt
│
├── Front/
│   └── vendor/
│       ├── src/
│       │   ├── components/
│       │   ├── api.js
│       │   ├── App.jsx
│       │   └── main.jsx
│       ├── package.json
│       └── vite.config.js
│
├── .gitignore
├── LICENSE
└── README.md
```

## Backend API

The FastAPI backend exposes authentication and application endpoints for vendor, procurement, purchase order, contract, invoice, performance, analytics, reports, notifications, and related operations.

OpenAPI / Swagger documentation is available at:

https://vendor-intelligence-deployment.onrender.com/docs

## Database

The deployed backend uses a PostgreSQL database hosted on Render.

The application database contains tables for areas including:

- Users
- Vendors
- Procurements
- Purchase Orders
- Purchase Order Items
- Contracts
- Invoices
- Notifications
- Vendor Performance
- Vendor Issues
- Vendor Documents
- Vendor Contacts
- Vendor Approvals
- Vendor Status History
- Communications
- Certifications
- Compliance Checks
- Companies
- Purchase Order Requests
- Purchase Order Request Items

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/HARISHPEC28/vendor-intelligence-deployment.git
cd vendor-intelligence-deployment
```

### 2. Backend setup

```bash
cd Back
python -m venv venv
```

Windows:

```cmd
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create/configure the backend environment variables required by the application, including:

```text
DATABASE_URL=<your-postgresql-connection-string>
SECRET_KEY=<your-secret-key>
```

Run the backend:

```bash
uvicorn main:app --reload
```

Backend will normally be available at:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

### 3. Frontend setup

Open a new terminal:

```bash
cd Front/vendor
npm install
npm run dev
```

The frontend will normally be available at:

http://localhost:5173

## Production Deployment

### Frontend - Render Static Site

The frontend is deployed on Render using:

- Service: `vendor-iq`
- Root Directory: `Front/vendor`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Live URL:

https://vendor-iq.onrender.com

### Backend - Render Web Service

The backend is deployed on Render using:

- Service: `vendor-intelligence-deployment`
- Root Directory: `Back`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Live URL:

https://vendor-intelligence-deployment.onrender.com

### Database - Render PostgreSQL

The backend connects to the Render PostgreSQL database through the `DATABASE_URL` environment variable.

The production database credentials and secrets are intentionally not stored in this repository.

## Environment Variables

Do not commit secrets to GitHub.

Backend environment variables:

```text
DATABASE_URL=<postgresql-database-url>
SECRET_KEY=<strong-random-secret>
```

Use secure values in production and keep credentials in Render Environment Variables or a local `.env` file that is excluded by `.gitignore`.

## Frontend API Configuration

The production frontend is configured to communicate with the deployed backend at:

```text
https://vendor-intelligence-deployment.onrender.com
```

Local development uses the local FastAPI server when configured for local execution.

## CORS Configuration

The backend allows the local development origins and the deployed Render frontend origin:

```text
http://localhost:5173
http://127.0.0.1:5173
https://vendor-iq.onrender.com
```

This allows the same backend to serve both local development and the deployed frontend.

## Testing the Deployment

1. Open the frontend:
   https://vendor-iq.onrender.com
2. Register or use an existing application account.
3. Log in through the frontend.
4. Verify the dashboard and role-based navigation.
5. Test vendor, procurement, purchase order, performance, analytics, reports, and notifications modules according to the user's role.
6. For backend verification, use the deployed API documentation:
   https://vendor-intelligence-deployment.onrender.com/docs

## Important Notes

- PostgreSQL is used for persistent application data.
- Dashboard, analytics, notifications, and reports are intended to work from database-backed application data.
- PDF and Excel export functionality is included in the Reports module.
- The repository does not contain production database passwords or secret keys.
- Database backup files should not be committed to GitHub unless they are intentionally sanitized and required for the project.

## Repository

GitHub:

https://github.com/HARISHPEC28/vendor-intelligence-deployment

## License

See the [LICENSE](LICENSE) file included in this repository.
