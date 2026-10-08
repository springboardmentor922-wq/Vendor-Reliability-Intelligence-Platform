import requests

BASE_URL = "http://127.0.0.1:8000"
LOGIN_EMAIL = "aish@test.com"
LOGIN_PASSWORD = "test1234"


def login():
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": LOGIN_EMAIL,
        "password": LOGIN_PASSWORD,
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_vendors(token):
    resp = requests.get(f"{BASE_URL}/vendors/", headers={"Authorization": f"Bearer {token}"})
    resp.raise_for_status()
    return resp.json()


def log_performance(token, vendor_id, on_time, quality, comm, response_hrs, notes):
    resp = requests.post(f"{BASE_URL}/performance/", json={
        "vendor_id": vendor_id,
        "on_time_delivery": on_time,
        "quality_rating": quality,
        "communication_rating": comm,
        "response_time_hours": response_hrs,
        "notes": notes,
    }, headers={"Authorization": f"Bearer {token}"})
    resp.raise_for_status()
    print(f"  Logged: on_time={on_time}, quality={quality}, comm={comm} -> {notes}")


def main():
    token = login()
    vendors = get_vendors(token)
    print(f"Found {len(vendors)} vendors")

    sample_entries = [
        (False, 2.5, 2.0, 40, "Early delivery delay, quality issues flagged"),
        (True, 3.5, 3.5, 20, "Improved after feedback, on time this round"),
        (True, 4.5, 4.5, 6, "Excellent — on time, high quality, fast response"),
    ]

    for vendor in vendors:
        print(f"\nSeeding performance for: {vendor['company_name']} (id={vendor['id']})")
        for entry in sample_entries:
            log_performance(token, vendor["id"], *entry)

    print("\nDone.")


if __name__ == "__main__":
    main()