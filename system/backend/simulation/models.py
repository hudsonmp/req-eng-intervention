from pydantic import BaseModel
from typing import Optional


class RiderSpec(BaseModel):
    id: str
    pickup_location: tuple[int, int]
    dropoff_location: tuple[int, int]
    request_time: float  # seconds into simulation
    party_size: int = 1
    needs_accessible: bool = False


class VehicleSpec(BaseModel):
    id: str
    location: tuple[int, int]
    capacity: int = 4
    is_occupied: bool = False
    is_accessible: bool = True
    current_direction: tuple[int, int] = (0, 0)  # heading vector
    destination: Optional[tuple[int, int]] = None
    assigned_rider: Optional[str] = None


class MetricsBundle(BaseModel):
    total_pickup_distance: float
    avg_wait_time: float
    avg_travel_time: float
    unserved_riders: int
    revenue: float
    gap_to_optimal_distance: float = 0.0
    gap_to_optimal_wait: float = 0.0
    gap_to_optimal_travel: float = 0.0


class RequirementSatisfaction(BaseModel):
    occupied_filtered: Optional[bool] = None
    capacity_checked: Optional[bool] = None
    accessibility_honored: Optional[bool] = None
    tiebreak_deterministic: Optional[bool] = None
    all_vehicles_considered: Optional[bool] = None
    satisfaction_rate: float = 0.0


class ScenarioSpec(BaseModel):
    id: str
    category: str
    seed: int
    riders: list[RiderSpec]
    vehicles: list[VehicleSpec]
    optimal_assignment: Optional[dict] = None  # {rider_id: vehicle_id}
    optimal_metrics: Optional[MetricsBundle] = None


class CodeSample(BaseModel):
    id: str
    prompt_type: str  # "novice" | "expert"
    generation_index: int
    raw_code: str
    parsed_function: Optional[str] = None
    parse_error: Optional[str] = None
    temperature: float = 0.7


class ExecutionResult(BaseModel):
    code_sample_id: str
    scenario_id: str
    assignments: Optional[list[dict]] = None  # [{"rider_id": str, "vehicle_id": str}]
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    timed_out: bool = False
