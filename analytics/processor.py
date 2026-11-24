"""
MC-05: Python Clinical Data Processing Module
Processes synthetic lab and appointment datasets.
Validates units, reference metadata, missing, and malformed values.
Generates operational reports, sample input/output, and execution benchmarks.
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import json
import time

@dataclass
class ValidationIssue:
    record_id: str
    field: str
    issue_type: str  # MISSING, MALFORMED, OUT_OF_RANGE, INVALID_UNIT
    message: str
    raw_value: Any

@dataclass
class ProcessingReport:
    timestamp: str
    dataset_type: str
    total_records: int
    valid_records: int
    invalid_records: int
    validation_issues: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    processing_time_ms: float

# Standard Clinical Reference Ranges and Expected Units
LAB_METADATA_SPEC: Dict[str, Dict[str, Any]] = {
    "GLUCOSE": {
        "valid_units": ["mg/dL", "mmol/L"],
        "default_unit": "mg/dL",
        "min_val": 20.0,
        "max_val": 1000.0,
        "normal_range": (70.0, 99.0),
    },
    "HEMOGLOBIN_A1C": {
        "valid_units": ["%"],
        "default_unit": "%",
        "min_val": 3.0,
        "max_val": 20.0,
        "normal_range": (4.0, 5.6),
    },
    "SERUM_CREATININE": {
        "valid_units": ["mg/dL", "umol/L"],
        "default_unit": "mg/dL",
        "min_val": 0.1,
        "max_val": 25.0,
        "normal_range": (0.6, 1.3),
    },
    "TOTAL_CHOLESTEROL": {
        "valid_units": ["mg/dL", "mmol/L"],
        "default_unit": "mg/dL",
        "min_val": 50.0,
        "max_val": 800.0,
        "normal_range": (125.0, 200.0),
    },
    "WHITE_BLOOD_CELLS": {
        "valid_units": ["10^3/uL", "x10^9/L"],
        "default_unit": "10^3/uL",
        "min_val": 0.5,
        "max_val": 100.0,
        "normal_range": (4.5, 11.0),
    },
}

VALID_APPOINTMENT_STATUSES = {
    "SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"
}

class ClinicalDataProcessor:
    """Processor and validator for synthetic clinical laboratory & appointment records."""

    @staticmethod
    def validate_and_process_lab_results(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], ProcessingReport]:
        start_time = time.perf_counter()
        valid_records: List[Dict[str, Any]] = []
        issues: List[ValidationIssue] = []
        
        status_counts: Dict[str, int] = {}
        abnormal_count = 0
        critical_count = 0

        for idx, raw in enumerate(records):
            rec_id = str(raw.get("id") or f"row-{idx+1}")
            has_error = False

            # Check patient identifier
            patient_id = raw.get("patientId")
            if not patient_id or not isinstance(patient_id, str) or not patient_id.strip():
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    field="patientId",
                    issue_type="MISSING",
                    message="Missing or empty patient identifier",
                    raw_value=patient_id
                ))
                has_error = True

            # Check test type
            test_type_raw = raw.get("testType")
            if not test_type_raw or not isinstance(test_type_raw, str):
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    field="testType",
                    issue_type="MISSING",
                    message="Missing testType field",
                    raw_value=test_type_raw
                ))
                has_error = True
                test_type = "UNKNOWN"
            else:
                test_type = test_type_raw.strip().upper()

            # Result value extraction and numeric validation
            value_raw = raw.get("value")
            unit_raw = raw.get("unit")
            numeric_val: Optional[float] = None

            if value_raw is None:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    field="value",
                    issue_type="MISSING",
                    message="Numeric result value is required",
                    raw_value=value_raw
                ))
                has_error = True
            else:
                try:
                    numeric_val = float(value_raw)
                except (ValueError, TypeError):
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        field="value",
                        issue_type="MALFORMED",
                        message=f"Value '{value_raw}' cannot be parsed as a float",
                        raw_value=value_raw
                    ))
                    has_error = True

            # Test-specific metadata validation
            spec = LAB_METADATA_SPEC.get(test_type)
            flag = "NORMAL"
            if spec and numeric_val is not None:
                # Validate Unit
                if not unit_raw or unit_raw not in spec["valid_units"]:
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        field="unit",
                        issue_type="INVALID_UNIT",
                        message=f"Unit '{unit_raw}' is invalid for test {test_type}. Expected: {spec['valid_units']}",
                        raw_value=unit_raw
                    ))
                    has_error = True

                # Validate physiologically plausible bounds
                if numeric_val < spec["min_val"] or numeric_val > spec["max_val"]:
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        field="value",
                        issue_type="OUT_OF_RANGE",
                        message=f"Value {numeric_val} outside physiological range [{spec['min_val']}, {spec['max_val']}]",
                        raw_value=numeric_val
                    ))
                    has_error = True

                # Determine normal / abnormal / critical
                low_norm, high_norm = spec["normal_range"]
                if numeric_val < low_norm:
                    flag = "LOW"
                    abnormal_count += 1
                elif numeric_val > high_norm:
                    flag = "HIGH"
                    abnormal_count += 1
                
                # Extreme out of range threshold
                if numeric_val <= spec["min_val"] * 1.5 or numeric_val >= spec["max_val"] * 0.85:
                    flag = "CRITICAL"
                    critical_count += 1

            # Validate date / timestamp
            timestamp_raw = raw.get("timestamp") or raw.get("createdAt")
            parsed_iso: Optional[str] = None
            if not timestamp_raw:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    field="timestamp",
                    issue_type="MISSING",
                    message="Missing result timestamp",
                    raw_value=timestamp_raw
                ))
                has_error = True
            else:
                try:
                    # Parse and convert to ISO 8601 UTC
                    dt = datetime.fromisoformat(str(timestamp_raw).replace("Z", "+00:00"))
                    parsed_iso = dt.isoformat()
                except Exception:
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        field="timestamp",
                        issue_type="MALFORMED",
                        message="Cannot parse timestamp as valid ISO-8601 datetime",
                        raw_value=timestamp_raw
                    ))
                    has_error = True

            status = str(raw.get("status", "FINAL")).upper()
            status_counts[status] = status_counts.get(status, 0) + 1

            if not has_error:
                valid_records.append({
                    "id": rec_id,
                    "patientId": patient_id,
                    "testType": test_type,
                    "value": numeric_val,
                    "unit": unit_raw,
                    "flag": flag,
                    "status": status,
                    "timestamp": parsed_iso,
                    "referenceRange": f"{spec['normal_range'][0]} - {spec['normal_range'][1]} {unit_raw}" if spec else raw.get("referenceRange", "N/A"),
                })

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        report = ProcessingReport(
            timestamp=datetime.now(timezone.utc).isoformat(),
            dataset_type="LABORATORY_RESULTS",
            total_records=len(records),
            valid_records=len(valid_records),
            invalid_records=len(records) - len(valid_records),
            validation_issues=[asdict(i) for i in issues],
            metrics={
                "abnormal_results_count": abnormal_count,
                "critical_results_count": critical_count,
                "status_distribution": status_counts,
                "tests_processed": list(set(r.get("testType") for r in valid_records)),
            },
            processing_time_ms=duration_ms
        )
        return valid_records, report

    @staticmethod
    def validate_and_process_appointments(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], ProcessingReport]:
        start_time = time.perf_counter()
        valid_records: List[Dict[str, Any]] = []
        issues: List[ValidationIssue] = []
        
        status_distribution: Dict[str, int] = {}
        total_duration_minutes = 0

        for idx, raw in enumerate(records):
            rec_id = str(raw.get("id") or f"appt-{idx+1}")
            has_error = False

            # Check Patient ID and Provider ID
            for f in ["patientId", "providerId"]:
                val = raw.get(f)
                if not val or not isinstance(val, str) or not val.strip():
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        field=f,
                        issue_type="MISSING",
                        message=f"Missing or invalid {f}",
                        raw_value=val
                    ))
                    has_error = True

            # Validate Status
            status = str(raw.get("status", "")).upper()
            if status not in VALID_APPOINTMENT_STATUSES:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    field="status",
                    issue_type="MALFORMED",
                    message=f"Unknown appointment status '{status}'. Valid: {list(VALID_APPOINTMENT_STATUSES)}",
                    raw_value=status
                ))
                has_error = True
            else:
                status_distribution[status] = status_distribution.get(status, 0) + 1

            # Validate Start & End Times
            start_dt: Optional[datetime] = None
            end_dt: Optional[datetime] = None

            start_raw = raw.get("startTime")
            end_raw = raw.get("endTime")

            if not start_raw or not end_raw:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    field="time_window",
                    issue_type="MISSING",
                    message="Both startTime and endTime are required",
                    raw_value={"startTime": start_raw, "endTime": end_raw}
                ))
                has_error = True
            else:
                try:
                    start_dt = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00"))
                    end_dt = datetime.fromisoformat(str(end_raw).replace("Z", "+00:00"))
                    
                    if end_dt <= start_dt:
                        issues.append(ValidationIssue(
                            record_id=rec_id,
                            field="time_window",
                            issue_type="OUT_OF_RANGE",
                            message=f"endTime ({end_raw}) must be strictly after startTime ({start_raw})",
                            raw_value={"startTime": start_raw, "endTime": end_raw}
                        ))
                        has_error = True
                    else:
                        duration_mins = int((end_dt - start_dt).total_seconds() / 60)
                        if duration_mins < 5 or duration_mins > 480:
                            issues.append(ValidationIssue(
                                record_id=rec_id,
                                field="duration",
                                issue_type="OUT_OF_RANGE",
                                message=f"Duration {duration_mins} min is outside normal range [5, 480]",
                                raw_value=duration_mins
                            ))
                            has_error = True
                        else:
                            total_duration_minutes += duration_mins
                except Exception as err:
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        field="time_window",
                        issue_type="MALFORMED",
                        message=f"Failed to parse datetime timestamps: {err}",
                        raw_value={"startTime": start_raw, "endTime": end_raw}
                    ))
                    has_error = True

            if not has_error and start_dt and end_dt:
                valid_records.append({
                    "id": rec_id,
                    "patientId": raw.get("patientId"),
                    "providerId": raw.get("providerId"),
                    "startTime": start_dt.isoformat(),
                    "endTime": end_dt.isoformat(),
                    "durationMinutes": int((end_dt - start_dt).total_seconds() / 60),
                    "status": status,
                    "type": raw.get("type", "ROUTINE_CHECKUP"),
                    "reason": raw.get("reason", "Consultation")
                })

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        valid_count = len(valid_records)
        avg_duration = round(total_duration_minutes / valid_count, 1) if valid_count > 0 else 0.0

        report = ProcessingReport(
            timestamp=datetime.now(timezone.utc).isoformat(),
            dataset_type="APPOINTMENTS",
            total_records=len(records),
            valid_records=valid_count,
            invalid_records=len(records) - valid_count,
            validation_issues=[asdict(i) for i in issues],
            metrics={
                "status_distribution": status_distribution,
                "average_duration_minutes": avg_duration,
                "total_scheduled_hours": round(total_duration_minutes / 60, 2),
            },
            processing_time_ms=duration_ms
        )
        return valid_records, report

    @staticmethod
    def run_benchmark(record_count: int = 5000) -> Dict[str, Any]:
        """Performance benchmark generating and validating synthetic clinical records."""
        synthetic_records: List[Dict[str, Any]] = []
        tests = list(LAB_METADATA_SPEC.keys())
        
        for i in range(record_count):
            t_type = tests[i % len(tests)]
            spec = LAB_METADATA_SPEC[t_type]
            unit = spec["default_unit"]
            # 90% valid, 10% injected anomalies for testing throughput with validations
            is_anomaly = (i % 10 == 0)
            val = -10.0 if is_anomaly else (spec["normal_range"][0] + (i % 20))
            
            synthetic_records.append({
                "id": f"bench-rec-{i}",
                "patientId": f"pat-{i % 100}",
                "testType": t_type,
                "value": val,
                "unit": "INVALID_U" if is_anomaly else unit,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "FINAL"
            })

        start = time.perf_counter()
        valid, report = ClinicalDataProcessor.validate_and_process_lab_results(synthetic_records)
        elapsed_sec = time.perf_counter() - start

        records_per_sec = round(record_count / elapsed_sec, 2) if elapsed_sec > 0 else 0
        return {
            "record_count": record_count,
            "processing_time_seconds": round(elapsed_sec, 4),
            "throughput_records_per_second": records_per_sec,
            "valid_records_count": len(valid),
            "invalid_records_count": len(synthetic_records) - len(valid),
            "issues_detected": len(report.validation_issues),
            "status": "PASS" if records_per_sec > 1000 else "DEGRADED"
        }
