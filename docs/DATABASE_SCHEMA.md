# Database schema

Core tables:
- users
- vendors
- procurement_requests
- purchase_orders
- contracts
- performance_records
- messages
- notifications
- activity_logs

Relationships:
- users.vendor_id -> vendors.id for vendor accounts
- purchase_orders.vendor_id -> vendors.id
- contracts.vendor_id -> vendors.id
- performance_records.vendor_id -> vendors.id
- messages.vendor_id -> vendors.id
- notifications.user_id -> users.id
- activity_logs.user_id -> users.id

Reliability:
Delivery 30%
Quality 20%
Communication 15%
Contract Compliance 15%
Purchase History 10%
Issue Resolution 10%

Risk:
- 80–100: Low
- 60–79.9: Medium
- below 60: High

These weights are implemented as a transparent demonstration rule; they can be adjusted with the mentor/team's agreed values.
