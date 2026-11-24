"""
MC-06: Clinical Analytics Service Schemas & Pydantic models.
Strictly non-diagnostic: Only aggregate metrics, operational throughput, and population epidemiology summaries.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class AppointmentUtilizationMetric(BaseModel):
    provider_id: str
    provider_name: Optional[str] = None
    department_id: Optional[str] = None
    total_slots_available: int
    total_booked: int
    completed_appointments: int
    cancelled_appointments: int
    no_show_appointments: int
    utilization_rate_pct: float = Field(..., ge=0.0, le=100.0)
    no_show_rate_pct: float = Field(..., ge=0.0, le=100.0)

class UtilizationSummaryResponse(BaseModel):
    status: str = "success"
    generated_at: str
    period_days: int
    overall_utilization_rate_pct: float
    provider_breakdown: List[AppointmentUtilizationMetric]

class WaitTimeMetric(BaseModel):
    department_name: str
    total_encounters: int
    average_wait_minutes: float
    median_wait_minutes: float
    p95_wait_minutes: float
    longest_wait_minutes: float

class WaitTimeResponse(BaseModel):
    status: str = "success"
    generated_at: str
    overall_average_wait_minutes: float
    department_metrics: List[WaitTimeMetric]

class LabTurnaroundMetric(BaseModel):
    test_type: str
    total_orders: int
    completed_orders: int
    average_turnaround_hours: float
    median_turnaround_hours: float
    target_hours: float
    compliance_rate_pct: float = Field(..., ge=0.0, le=100.0)

class LabTurnaroundResponse(BaseModel):
    status: str = "success"
    generated_at: str
    total_samples_analyzed: int
    average_overall_turnaround_hours: float
    metrics_by_test: List[LabTurnaroundMetric]

class AgeDistribution(BaseModel):
    age_group: str  # e.g., "0-17", "18-35", "36-50", "51-65", "65+"
    count: int
    percentage: float

class PopulationHealthReport(BaseModel):
    status: str = "success"
    generated_at: str
    total_registered_patients: int
    gender_distribution: Dict[str, int]
    blood_group_distribution: Dict[str, int]
    age_distribution: List[AgeDistribution]
    top_primary_diagnoses: List[Dict[str, Any]]
    disclaimer: str = (
        "NON-DIAGNOSTIC NOTICE: This aggregate statistical report is strictly for "
        "hospital operational capacity planning and demographic resource allocation. "
        "It does not constitute medical advice or automated clinical diagnosis."
    )

class BenchmarkResponse(BaseModel):
    status: str = "success"
    generated_at: str
    benchmark_results: Dict[str, Any]
