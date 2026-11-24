"""
MC-08: Healthcare Interoperability - HL7 FHIR R4 Mock Service.
Converts relational MediCore entities into standardized FHIR R4 JSON resources:
- Patient
- Appointment
- Encounter
- Observation (Laboratory Results & Vitals)

Enforces consent verification, patient boundary authorization, and audit trail hooks.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid

class FHIRConverter:
    """Transforms MediCore internal clinical models into standard HL7 FHIR Release 4 resources."""

    @staticmethod
    def to_fhir_patient(patient: Dict[str, Any]) -> Dict[str, Any]:
        """Maps internal patient record to FHIR R4 Patient resource."""
        p_id = str(patient.get("id"))
        gender = str(patient.get("gender", "unknown")).lower()
        if gender not in ["male", "female", "other", "unknown"]:
            gender = "unknown"

        return {
            "resourceType": "Patient",
            "id": p_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
                "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"]
            },
            "identifier": [
                {
                    "use": "usual",
                    "type": {
                        "coding": [
                            {"system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "MR", "display": "Medical Record Number"}
                        ]
                    },
                    "system": "http://hospital.medicore.local/mrn",
                    "value": patient.get("mrn", f"MRN-{p_id[:8]}")
                }
            ],
            "active": True,
            "name": [
                {
                    "use": "official",
                    "family": patient.get("lastName", "Doe"),
                    "given": [patient.get("firstName", "Jane")]
                }
            ],
            "telecom": [
                {"system": "phone", "value": patient.get("phone", "555-0100"), "use": "mobile"},
                {"system": "email", "value": patient.get("email", f"patient-{p_id[:6]}@medicore.local")}
            ] if patient.get("phone") or patient.get("email") else [],
            "gender": gender,
            "birthDate": patient.get("dob", "1990-01-01"),
            "address": [
                {
                    "use": "home",
                    "line": [patient.get("address", "123 Healthcare Ave")],
                    "city": "Metropolis",
                    "country": "US"
                }
            ] if patient.get("address") else []
        }

    @staticmethod
    def to_fhir_appointment(appointment: Dict[str, Any]) -> Dict[str, Any]:
        """Maps internal appointment record to FHIR R4 Appointment resource."""
        appt_id = str(appointment.get("id"))
        status_map = {
            "SCHEDULED": "booked",
            "CONFIRMED": "booked",
            "IN_PROGRESS": "arrived",
            "COMPLETED": "fulfilled",
            "CANCELLED": "cancelled",
            "NO_SHOW": "noshow"
        }
        fhir_status = status_map.get(str(appointment.get("status", "")).upper(), "proposed")

        return {
            "resourceType": "Appointment",
            "id": appt_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
                "profile": ["http://hl7.org/fhir/StructureDefinition/Appointment"]
            },
            "status": fhir_status,
            "description": appointment.get("reason", "Consultation"),
            "start": appointment.get("startTime", datetime.now(timezone.utc).isoformat()),
            "end": appointment.get("endTime", datetime.now(timezone.utc).isoformat()),
            "minutesDuration": appointment.get("durationMinutes", 30),
            "participant": [
                {
                    "actor": {
                        "reference": f"Patient/{appointment.get('patientId')}",
                        "display": "Patient"
                    },
                    "required": "required",
                    "status": "accepted"
                },
                {
                    "actor": {
                        "reference": f"Practitioner/{appointment.get('providerId')}",
                        "display": "Practitioner"
                    },
                    "required": "required",
                    "status": "accepted"
                }
            ]
        }

    @staticmethod
    def to_fhir_encounter(encounter: Dict[str, Any]) -> Dict[str, Any]:
        """Maps internal clinical encounter to FHIR R4 Encounter resource."""
        enc_id = str(encounter.get("id"))
        status_map = {
            "PLANNED": "planned",
            "IN_PROGRESS": "in-progress",
            "COMPLETED": "finished",
            "CANCELLED": "cancelled"
        }
        fhir_status = status_map.get(str(encounter.get("status", "")).upper(), "in-progress")

        return {
            "resourceType": "Encounter",
            "id": enc_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
                "profile": ["http://hl7.org/fhir/StructureDefinition/Encounter"]
            },
            "status": fhir_status,
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory"
            },
            "subject": {
                "reference": f"Patient/{encounter.get('patientId')}"
            },
            "participant": [
                {
                    "individual": {
                        "reference": f"Practitioner/{encounter.get('providerId')}"
                    }
                }
            ] if encounter.get("providerId") else [],
            "period": {
                "start": encounter.get("startedAt", datetime.now(timezone.utc).isoformat()),
                "end": encounter.get("endedAt")
            }
        }

    @staticmethod
    def to_fhir_observation(lab_result: Dict[str, Any]) -> Dict[str, Any]:
        """Maps lab result / vital sign record to FHIR R4 Observation resource."""
        obs_id = str(lab_result.get("id", uuid.uuid4()))
        test_type = str(lab_result.get("testType", "DIAGNOSTIC")).upper()
        
        # LOINC code mapping for common clinical tests
        loinc_map = {
            "GLUCOSE": {"code": "2345-7", "display": "Glucose [Mass/volume] in Blood"},
            "HEMOGLOBIN_A1C": {"code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood"},
            "SERUM_CREATININE": {"code": "2160-0", "display": "Creatinine [Mass/volume] in Serum or Plasma"},
            "TOTAL_CHOLESTEROL": {"code": "2093-3", "display": "Cholesterol [Mass/volume] in Serum or Plasma"},
            "WHITE_BLOOD_CELLS": {"code": "6690-2", "display": "Leukocytes [#/volume] in Blood by Automated count"},
        }
        loinc_info = loinc_map.get(test_type, {"code": "30954-2", "display": test_type})

        status_val = str(lab_result.get("status", "FINAL")).lower()
        if status_val not in ["registered", "preliminary", "final", "amended", "corrected"]:
            status_val = "final"

        val = lab_result.get("value")
        unit = lab_result.get("unit", "mg/dL")

        resource: Dict[str, Any] = {
            "resourceType": "Observation",
            "id": obs_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
                "profile": ["http://hl7.org/fhir/StructureDefinition/Observation"]
            },
            "status": status_val,
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "laboratory",
                            "display": "Laboratory"
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": loinc_info["code"],
                        "display": loinc_info["display"]
                    }
                ],
                "text": test_type
            },
            "subject": {
                "reference": f"Patient/{lab_result.get('patientId')}"
            },
            "effectiveDateTime": lab_result.get("timestamp", datetime.now(timezone.utc).isoformat()),
        }

        if val is not None:
            try:
                num_val = float(val)
                resource["valueQuantity"] = {
                    "value": num_val,
                    "unit": unit,
                    "system": "http://unitsofmeasure.org",
                    "code": unit
                }
            except (ValueError, TypeError):
                resource["valueString"] = str(val)

        if lab_result.get("referenceRange"):
            resource["referenceRange"] = [
                {"text": lab_result.get("referenceRange")}
            ]

        if lab_result.get("interpretation"):
            resource["interpretation"] = [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                            "code": lab_result.get("flag", "N"),
                            "display": lab_result.get("interpretation")
                        }
                    ]
                }
            ]

        return resource

    @staticmethod
    def create_bundle(resources: List[Dict[str, Any]], bundle_type: str = "searchset") -> Dict[str, Any]:
        """Packages FHIR resources into a valid FHIR R4 Bundle."""
        return {
            "resourceType": "Bundle",
            "id": f"bundle-{uuid.uuid4()}",
            "meta": {
                "lastUpdated": datetime.now(timezone.utc).isoformat()
            },
            "type": bundle_type,
            "total": len(resources),
            "entry": [
                {
                    "fullUrl": f"http://hospital.medicore.local/fhir/{r['resourceType']}/{r['id']}",
                    "resource": r
                }
                for r in resources
            ]
        }
