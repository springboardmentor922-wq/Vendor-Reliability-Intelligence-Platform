# Entity Relationship (ER) Diagram

## 1. Milestone 1 Implemented Schema & Future System ER Model

```mermaid
erDiagram
    users {
        int id PK
        string full_name
        string email UK
        string password_hash
        string role
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    vendors {
        int id PK
        string company_name
        string tax_id UK
        string contact_email
        string status
        float reliability_score
        timestamp created_at
    }

    purchase_orders {
        int id PK
        string po_number UK
        int vendor_id FK
        int created_by FK
        decimal total_amount
        string status
        timestamp delivery_date
        timestamp created_at
    }

    vendor_performance_logs {
        int id PK
        int vendor_id FK
        int po_id FK
        boolean on_time_delivery
        float quality_rating
        float defect_rate
        timestamp recorded_at
    }

    audit_logs {
        int id PK
        int user_id FK
        string action
        string resource
        timestamp timestamp
    }

    users ||--o{ purchase_orders : "creates"
    users ||--o{ audit_logs : "triggers"
    vendors ||--o{ purchase_orders : "fulfills"
    vendors ||--o{ vendor_performance_logs : "evaluated_in"
    purchase_orders ||--o{ vendor_performance_logs : "yields"
```

> [!NOTE]
> Solid entities (`users`) represent active implemented models in Milestone 1. Dashed/planned entities (`vendors`, `purchase_orders`, `vendor_performance_logs`, `audit_logs`) outline the architectural blueprint for Milestones 2 and 3.
