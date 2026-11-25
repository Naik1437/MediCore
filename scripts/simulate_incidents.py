"""Execute MC-15 scenarios and record only observed evidence."""
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from analytics.worker import NotificationJob, NotificationWorker

API_URL = os.getenv("API_URL", "http://localhost:4002/api/v1")
EVIDENCE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "incident_simulation_evidence.json"))
TEST_PASSWORD = os.getenv("MEDICORE_TEST_PASSWORD")
RECEPTIONIST_EMAIL = os.getenv("RECEPTIONIST_EMAIL", "receptionist@medicore.local")
LAB_TECH_EMAIL = os.getenv("LAB_TECH_EMAIL", "labtech@medicore.local")
DOCTOR_EMAIL = os.getenv("DOCTOR_EMAIL", "doctor@medicore.local")
DB_OUTAGE_API_URL = os.getenv("DB_OUTAGE_API_URL")
evidence_log = {"execution_timestamp": datetime.now(timezone.utc).isoformat(), "scenarios": []}

def record(scenario: int, title: str, passed: bool, evidence: dict) -> bool:
    status = "PASS" if passed else "FAIL"
    evidence_log["scenarios"].append({"scenario": scenario, "title": title, "status": status,
        "executed_at": datetime.now(timezone.utc).isoformat(), "evidence": evidence})
    print(f"{title}: {status} - {evidence}")
    return passed

def login(email: str) -> str:
    if not TEST_PASSWORD:
        raise RuntimeError("MEDICORE_TEST_PASSWORD is required; credentials are never embedded in the script")
    response = httpx.post(f"{API_URL}/auth/login", json={"email": email, "password": TEST_PASSWORD}, timeout=3.0)
    response.raise_for_status()
    return response.json()["data"]["accessToken"]

def discover_receptionist(token: str) -> tuple[dict, dict, dict, dict]:
    headers = {"Authorization": f"Bearer {token}"}
    def get(path: str) -> list:
        response = httpx.get(f"{API_URL}/{path}", headers=headers, timeout=3.0)
        response.raise_for_status()
        body = response.json()
        return body.get("data", body.get("items", []))
    patients = get("patients")
    providers = get("providers")
    departments = get("departments")
    if len(patients) < 2 or not providers or not departments:
        raise RuntimeError("existing synthetic patients, provider and department are required")
    return patients[0], patients[1], providers[0], {"department": departments[0]}

def simulate_unauthorized_record_access() -> bool:
    try:
        response = httpx.get(f"{API_URL}/encounters", timeout=3.0)
        return record(1, "Unauthorized record access", response.status_code in (401, 403),
                      {"http_status": response.status_code, "payload": response.json()})
    except Exception as exc:
        return record(1, "Unauthorized record access", False, {"error": str(exc), "observed": False})

def simulate_appointment_collision() -> bool:
    try:
        token = login(RECEPTIONIST_EMAIL)
        patient_a, patient_b, provider, related = discover_receptionist(token)
        headers = {"Authorization": f"Bearer {token}"}
        slot = None
        for offset in range(1, 91):
            date = (datetime.now(timezone.utc) + timedelta(days=offset)).date().isoformat()
            availability = httpx.get(f"{API_URL}/providers/{provider['id']}/availability",
                                     params={"date": date}, headers=headers, timeout=3.0)
            availability.raise_for_status()
            slots = availability.json().get("data", {}).get("slots", [])
            slot = next((item for item in slots if item.get("available") is True), None)
            if slot:
                break
        if not slot:
            raise RuntimeError("no available future provider slot found")
        base = {"providerId": provider["id"], "departmentId": related["department"]["id"],
            "scheduledStart": slot["start"], "scheduledEnd": slot["end"],
            "reason": f"MC-15 synthetic collision {uuid.uuid4()}"}
        first = httpx.post(f"{API_URL}/appointments", headers=headers, json={**base, "patientId": patient_a["id"]}, timeout=3.0)
        second = httpx.post(f"{API_URL}/appointments", headers=headers, json={**base, "patientId": patient_b["id"]}, timeout=3.0)
        return record(2, "Appointment collision", first.status_code in (200, 201) and second.status_code == 409,
                      {"first_status": first.status_code, "second_status": second.status_code, "constraint": "appointment_no_overlap"})
    except Exception as exc:
        return record(2, "Appointment collision", False, {"error": str(exc), "observed": False})

def simulate_notification_dlq() -> bool:
    worker = NotificationWorker()
    result = worker.dispatch(NotificationJob("invalid-malformed-address", "EMAIL", "MC15", {}, "mc15-dlq", 2))
    dlq = worker.get_dlq()
    return record(3, "Notification sandbox DLQ", result["status"] == "FAILED" and result["attempts"] == 2 and len(dlq) == 1,
                  {"job": result, "dlq_count": len(dlq), "delivery_mode": "local deterministic sandbox"})

def simulate_lab_mismatch() -> bool:
    try:
        token = login(LAB_TECH_EMAIL)
        explicit_order_id = os.getenv("MC15_LAB_ORDER_ID") or os.getenv("SYNTHETIC_LAB_ORDER")
        explicit_correct_patient_id = os.getenv("MC15_CORRECT_PATIENT_ID") or os.getenv("SYNTHETIC_PATIENT_A")
        explicit_mismatch_patient_id = os.getenv("MC15_MISMATCHED_PATIENT_ID") or os.getenv("SYNTHETIC_PATIENT_B")

        if explicit_order_id and explicit_correct_patient_id and explicit_mismatch_patient_id:
            lab_order_id = explicit_order_id
            correct_patient_id = explicit_correct_patient_id
            mismatch_patient_id = explicit_mismatch_patient_id
        else:
            receptionist_token = login(RECEPTIONIST_EMAIL)
            patient_a, patient_b, provider, related = discover_receptionist(receptionist_token)
            doctor_token = login(DOCTOR_EMAIL)
            lab_response = httpx.get(f"{API_URL}/lab/orders", headers={"Authorization": f"Bearer {doctor_token}"}, timeout=3.0)
            lab_response.raise_for_status()
            lab_body = lab_response.json()
            orders = lab_body.get("data", lab_body.get("items", []))
            active_orders = [item for item in orders if item.get("status") not in ("COMPLETED", "CANCELLED")]
            if active_orders:
                lab_order = active_orders[0]
            else:
                encounter_response = httpx.get(f"{API_URL}/encounters", headers={"Authorization": f"Bearer {doctor_token}"}, timeout=3.0)
                encounter_response.raise_for_status()
                encounters = encounter_response.json().get("data", encounter_response.json().get("items", []))
                encounter = next(iter(encounters), None)
                if not encounter:
                    raise RuntimeError("no existing synthetic encounter available to create a lab order")
                create_response = httpx.post(f"{API_URL}/lab/orders", headers={"Authorization": f"Bearer {doctor_token}"}, json={
                    "encounterId": encounter["id"], "patientId": encounter["patientId"],
                    "providerId": encounter["providerId"], "departmentId": related["department"]["id"],
                    "testType": "MC15_SYNTHETIC_MISMATCH", "priority": "ROUTINE"
                }, timeout=3.0)
                create_response.raise_for_status()
                lab_order = create_response.json()["data"]
            correct_patient_id = lab_order["patientId"]
            mismatch_patient_id = patient_a["id"] if patient_a["id"] != correct_patient_id else patient_b["id"]
            lab_order_id = lab_order["id"]

        if correct_patient_id == mismatch_patient_id:
            raise RuntimeError("correct and mismatched patient IDs must differ")

        response = httpx.post(f"{API_URL}/lab/results", headers={"Authorization": f"Bearer {token}"}, json={
            "labOrderId": lab_order_id,
            "patientId": mismatch_patient_id,
            "resultValues": {"synthetic": 1},
            "status": "FINAL"
        }, timeout=3.0)
        body = response.json()
        error = body.get("error", {})
        expected_message = "Integrity violation: The specified patient does not match the patient associated with this laboratory order"
        passed = response.status_code == 400 and error.get("code") == "BAD_REQUEST" and error.get("message") == expected_message
        return record(4, "Lab result patient mismatch", passed, {
            "http_status": response.status_code,
            "error_code": error.get("code"),
            "error_message": error.get("message"),
            "lab_order_id": lab_order_id,
            "correct_patient_id": correct_patient_id,
            "mismatched_patient_id": mismatch_patient_id,
            "observed": True
        })
    except Exception as exc:
        return record(4, "Lab result patient mismatch", False, {"error": str(exc), "observed": False})

def simulate_database_outage() -> bool:
    if not DB_OUTAGE_API_URL:
        return record(5, "Database outage resilience", False, {"error": "DB_OUTAGE_API_URL is required for an isolated outage environment"})
    try:
        outage_token = login(RECEPTIONIST_EMAIL)
        response = httpx.get(f"{DB_OUTAGE_API_URL.rstrip('/')}/api/v1/patients",
                             headers={"Authorization": f"Bearer {outage_token}"}, timeout=3.0)
        body = response.json()
        return record(5, "Database outage resilience", response.status_code == 503 and
                      body.get("error", {}).get("code") == "SERVICE_UNAVAILABLE",
                      {"http_status": response.status_code, "payload": body, "observed": True})
    except Exception as exc:
        return record(5, "Database outage resilience", False, {"error": str(exc), "observed": False})

if __name__ == "__main__":
    results = [simulate_unauthorized_record_access(), simulate_appointment_collision(), simulate_notification_dlq(),
               simulate_lab_mismatch(), simulate_database_outage()]
    os.makedirs(os.path.dirname(EVIDENCE_FILE), exist_ok=True)
    with open(EVIDENCE_FILE, "w", encoding="utf-8") as evidence_file:
        json.dump(evidence_log, evidence_file, indent=2)
    print(f"Evidence written to {EVIDENCE_FILE}")
    raise SystemExit(0 if all(results) else 1)
