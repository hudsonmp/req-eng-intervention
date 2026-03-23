"""Ground truth solver using the Hungarian algorithm.

Computes optimal rider-vehicle assignments that minimize a weighted cost
combining pickup distance, wait time, and travel time.
"""

import numpy as np
from scipy.optimize import linear_sum_assignment
from .models import RiderSpec, VehicleSpec, ScenarioSpec, MetricsBundle

# From waymo.md
SPEED = 1.0  # cells per second (1 cell ~ 1 mile, 1 second ~ 1 minute)
BASE_FARE = 7.50
RATE_PER_MILE = 1.70
RATE_PER_MIN = 0.35
OPS_COST_PER_MILE = 0.40

# Weights for multi-objective cost (equal weighting by default)
W_DISTANCE = 1.0
W_WAIT = 1.0
W_TRAVEL = 1.0


def manhattan(a: tuple[int, int], b: tuple[int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def is_eligible(vehicle: VehicleSpec, rider: RiderSpec) -> bool:
    if vehicle.is_occupied:
        return False
    if vehicle.capacity < rider.party_size:
        return False
    if rider.needs_accessible and not vehicle.is_accessible:
        return False
    return True


def compute_cost(vehicle: VehicleSpec, rider: RiderSpec) -> float:
    pickup_dist = manhattan(vehicle.location, rider.pickup_location)
    wait_time = rider.request_time + pickup_dist / SPEED
    travel_dist = manhattan(rider.pickup_location, rider.dropoff_location)
    travel_time = travel_dist / SPEED
    return (W_DISTANCE * pickup_dist +
            W_WAIT * wait_time +
            W_TRAVEL * travel_time)


def compute_metrics_from_assignment(
    assignment: dict[str, str],
    riders: list[RiderSpec],
    vehicles: list[VehicleSpec],
) -> MetricsBundle:
    rider_map = {r.id: r for r in riders}
    vehicle_map = {v.id: v for v in vehicles}

    total_pickup_dist = 0.0
    wait_times = []
    travel_times = []
    total_revenue = 0.0
    served = set()

    for rider_id, vehicle_id in assignment.items():
        if vehicle_id is None:
            continue
        rider = rider_map[rider_id]
        vehicle = vehicle_map[vehicle_id]
        served.add(rider_id)

        pickup_dist = manhattan(vehicle.location, rider.pickup_location)
        travel_dist = manhattan(rider.pickup_location, rider.dropoff_location)
        pickup_time = pickup_dist / SPEED
        travel_time = travel_dist / SPEED

        total_pickup_dist += pickup_dist
        wait_times.append(rider.request_time + pickup_time)
        travel_times.append(travel_time)

        gross = BASE_FARE + travel_dist * RATE_PER_MILE + travel_time * RATE_PER_MIN
        cost = (pickup_dist + travel_dist) * OPS_COST_PER_MILE
        total_revenue += gross - cost

    unserved = len(riders) - len(served)

    return MetricsBundle(
        total_pickup_distance=total_pickup_dist,
        avg_wait_time=sum(wait_times) / len(wait_times) if wait_times else 0.0,
        avg_travel_time=sum(travel_times) / len(travel_times) if travel_times else 0.0,
        unserved_riders=unserved,
        revenue=round(total_revenue, 2),
    )


def solve_optimal(scenario: ScenarioSpec) -> tuple[dict[str, str], MetricsBundle]:
    """Solve the optimal assignment using the Hungarian algorithm.

    Returns (assignment_dict, metrics) where assignment_dict maps rider_id -> vehicle_id.
    Ineligible pairs get infinite cost so they're never matched.
    """
    riders = scenario.riders
    vehicles = scenario.vehicles

    n_riders = len(riders)
    n_vehicles = len(vehicles)

    if n_riders == 0 or n_vehicles == 0:
        return {}, MetricsBundle(
            total_pickup_distance=0, avg_wait_time=0, avg_travel_time=0,
            unserved_riders=n_riders, revenue=0,
        )

    # Build cost matrix: rows=riders, cols=vehicles
    INF = 1e9
    cost_matrix = np.full((n_riders, n_vehicles), INF)

    for i, rider in enumerate(riders):
        for j, vehicle in enumerate(vehicles):
            if is_eligible(vehicle, rider):
                cost_matrix[i, j] = compute_cost(vehicle, rider)

    row_ind, col_ind = linear_sum_assignment(cost_matrix)

    assignment = {}
    for i, j in zip(row_ind, col_ind):
        if cost_matrix[i, j] < INF:
            assignment[riders[i].id] = vehicles[j].id

    metrics = compute_metrics_from_assignment(assignment, riders, vehicles)
    return assignment, metrics
