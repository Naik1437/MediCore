"""
Targeted Tests for MediCore Batch 3:
- MC-05: Python clinical data processing (units, validation, benchmarks)
- MC-06: FastAPI clinical analytics endpoints (utilization, wait-times, turnaround, population health)
- MC-08: Healthcare interoperability (FHIR R4 resources, notification idempotency)
"""

import pytest
from fastapi.testclient import TestClient
from analytics.main import app, SHARED_SECRET
from analytics.processor import ClinicalDataProcessor
from analytics.fhir import FHIRConverter
from analytics.worker import NotificationJob, NotificationWorker

client = TestClient(app)

# --- MC-05: Clinical Data Processor Tests ---

def test_mc05_lab_data_validation_and_unit_checks():
    test_records = [
        # Valid Glucose
        {
            "id": "rec-01",
            "patientId": "pat-101",
            "testType": "GLUCOSE",
            "value": 95.0,
            "unit": "mg/dL",
            "timestamp": "2026-11-20T10:00:00Z"
        },
        # Invalid Unit for Glucose
        {
            "id": "rec-02",
            "patientId": "pat-102",
            "testType": "GLUCOSE",
            "value": 95.0,
            "unit": "INVALID_UNIT",
            "timestamp": "2026-11-20T10:00:00Z"
        },
        # Out of physiological range (negative value)
        {
            "id": "rec-03",
            "patientId": "pat-103",
            "testType": "HEMOGLOBIN_A1C",
            "value": -1.0,
            "unit": "%",
            "timestamp": "2026-11-20T10:00:00Z"
        },
        # Missing Value
        {
            "id": "rec-04",
            "patientId": "pat-104",
            "testType": "TOTAL_CHOLESTEROL",
            "value": None,
            "unit": "mg/dL",
            "timestamp": "2026-11-20T10:00:00Z"
        }
    ]

    valid, report = ClinicalDataProcessor.validate_and_process_lab_results(test_records)
    assert len(valid) == 1
    assert valid[0]["id"] == "rec-01"
    assert valid[0]["flag"] == "NORMAL"
    assert report.total_records == 4
    assert report.valid_records == 1
    assert report.invalid_records == 3
    assert len(report.validation_issues) == 3

def test_mc05_appointment_data_processing():
    appt_records = [
        # Valid appointment
        {
            "id": "app-01",
            "patientId": "pat-101",
            "providerId": "doc-01",
            "status": "COMPLETED",
            "startTime": "2026-11-20T09:00:00Z",
            "endTime": "2026-11-20T09:30:00Z"
        },
        # Malformed: endTime before startTime
        {
            "id": "app-02",
            "patientId": "pat-102",
            "providerId": "doc-01",
            "status": "SCHEDULED",
            "startTime": "2026-11-20T10:00:00Z",
            "endTime": "2026-11-20T09:30:00Z"
        },
        # Invalid status
        {
            "id": "app-03",
            "patientId": "pat-103",
            "providerId": "doc-01",
            "status": "UNKNOWN_STATUS",
            "startTime": "2026-11-20T11:00:00Z",
            "endTime": "2026-11-20T11:30:00Z"
        }
    ]

    valid, report = ClinicalDataProcessor.validate_and_process_appointments(appt_records)
    assert len(valid) == 1
    assert valid[0]["durationMinutes"] == 30
    assert report.valid_records == 1
    assert report.invalid_records == 2

def test_mc05_performance_benchmark():
    benchmark_res = ClinicalDataProcessor.run_benchmark(record_count=1000)
    assert benchmark_res["record_count"] == 1000
    assert benchmark_res["throughput_records_per_second"] > 500
    assert benchmark_res["status"] == "PASS"

# --- MC-06: FastAPI Clinical Analytics Endpoint Tests ---

def test_mc06_analytics_endpoints_require_authorization():
    # Default Deny: Calling without authorization header returns 401
    res = client.get("/api/v1/analytics/utilization")
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED"

def test_mc06_analytics_utilization_with_authorized_key():
    headers = {"x-internal-key": SHARED_SECRET}
    res = client.get("/api/v1/analytics/utilization?period_days=14", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["period_days"] == 14
    assert "overall_utilization_rate_pct" in data
    assert len(data["provider_breakdown"]) >= 1

def test_mc06_analytics_wait_times():
    headers = {"x-internal-key": SHARED_SECRET}
    res = client.get("/api/v1/analytics/wait-times", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "overall_average_wait_minutes" in data
    assert len(data["department_metrics"]) >= 1

def test_mc06_analytics_lab_turnaround():
    headers = {"x-internal-key": SHARED_SECRET}
    res = client.get("/api/v1/analytics/lab-turnaround", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "average_overall_turnaround_hours" in data
    assert len(data["metrics_by_test"]) >= 1

def test_mc06_population_health_non_diagnostic_notice():
    headers = {"x-internal-key": SHARED_SECRET}
    res = client.get("/api/v1/analytics/population-health", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "NON-DIAGNOSTIC NOTICE" in data["disclaimer"]
    assert "gender_distribution" in data
    assert "age_distribution" in data

# --- MC-08: Healthcare Interoperability & Notification Tests ---

def test_mc08_fhir_metadata_capability_statement():
    res = client.get("/fhir/r4/metadata")
    assert res.status_code == 200
    data = res.json()
    assert data["resourceType"] == "CapabilityStatement"
    assert data["fhirVersion"] == "4.0.1"

def test_mc08_fhir_patient_resource():
    headers = {"x-internal-key": SHARED_SECRET}
    res = client.get("/fhir/r4/Patient/pat-test-uuid", headers=headers)
    assert res.status_code == 200
    fhir_pat = res.json()
    assert fhir_pat["resourceType"] == "Patient"
    assert fhir_pat["id"] == "pat-test-uuid"
    assert fhir_pat["active"] is True
    assert len(fhir_pat["identifier"]) >= 1

def test_mc08_fhir_observation_bundle():
    headers = {"x-internal-key": SHARED_SECRET}
    res = client.get("/fhir/r4/Observation?patient=pat-101", headers=headers)
    assert res.status_code == 200
    bundle = res.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "searchset"
    assert bundle["total"] >= 1
    assert bundle["entry"][0]["resource"]["resourceType"] == "Observation"

def test_mc08_notification_worker_idempotency_and_retry():
    worker = NotificationWorker()
    job1 = NotificationJob(
        recipient="patient@medicore.local",
        channel="EMAIL",
        template_id="APPT_REMINDER",
        payload={"patientName": "Alice Morgan"},
        idempotency_key="unique-msg-key-100"
    )
    result1 = worker.dispatch(job1)
    assert result1["status"] == "SENT"
    assert result1["attempts"] == 1

    # Resubmitting identical idempotency key must not deliver duplicate message
    job2 = NotificationJob(
        recipient="patient@medicore.local",
        channel="EMAIL",
        template_id="APPT_REMINDER",
        payload={"patientName": "Alice Morgan"},
        idempotency_key="unique-msg-key-100"
    )
    result2 = worker.dispatch(job2)
    assert result2["status"] == "DUPLICATE_SKIPPED"

def test_mc08_notification_worker_failure_handling():
    worker = NotificationWorker()
    invalid_job = NotificationJob(
        recipient="bad-addr",  # Malformed address triggers failure
        channel="EMAIL",
        template_id="APPT_REMINDER",
        payload={},
        idempotency_key="unique-fail-key-200",
        max_retries=2
    )
    res = worker.dispatch(invalid_job)
    assert res["status"] == "FAILED"
    assert res["attempts"] == 2
    assert "Invalid delivery address" in res["last_error"]
