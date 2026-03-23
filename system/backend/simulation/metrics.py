"""Metric computation for simulation results."""

from .models import (
    ExecutionResult, ScenarioSpec, MetricsBundle, RequirementSatisfaction,
)
from .optimal import manhattan, is_eligible, SPEED, BASE_FARE, RATE_PER_MILE, RATE_PER_MIN, OPS_COST_PER_MILE


def compute_metrics(result: ExecutionResult, scenario: ScenarioSpec) -> MetricsBundle:
    """Compute the 6 metrics from an execution result."""
    if result.error or not result.assignments:
        return MetricsBundle(
            total_pickup_distance=0,
            avg_wait_time=0,
            avg_travel_time=0,
            unserved_riders=len(scenario.riders),
            revenue=0,
            gap_to_optimal_distance=float("inf"),
            gap_to_optimal_wait=float("inf"),
            gap_to_optimal_travel=float("inf"),
        )

    rider_map = {r.id: r for r in scenario.riders}
    vehicle_map = {v.id: v for v in scenario.vehicles}

    total_pickup_dist = 0.0
    wait_times = []
    travel_times = []
    total_revenue = 0.0
    served = set()

    for a in result.assignments:
        rid = a.get("rider_id")
        vid = a.get("vehicle_id")
        if rid not in rider_map or vid not in vehicle_map:
            continue

        rider = rider_map[rid]
        vehicle = vehicle_map[vid]
        served.add(rid)

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

    unserved = len(scenario.riders) - len(served)
    avg_wait = sum(wait_times) / len(wait_times) if wait_times else 0.0
    avg_travel = sum(travel_times) / len(travel_times) if travel_times else 0.0

    # Gap to optimal
    opt = scenario.optimal_metrics
    gap_dist = _gap(total_pickup_dist, opt.total_pickup_distance) if opt else 0
    gap_wait = _gap(avg_wait, opt.avg_wait_time) if opt else 0
    gap_travel = _gap(avg_travel, opt.avg_travel_time) if opt else 0

    return MetricsBundle(
        total_pickup_distance=total_pickup_dist,
        avg_wait_time=avg_wait,
        avg_travel_time=avg_travel,
        unserved_riders=unserved,
        revenue=round(total_revenue, 2),
        gap_to_optimal_distance=gap_dist,
        gap_to_optimal_wait=gap_wait,
        gap_to_optimal_travel=gap_travel,
    )


def _gap(actual: float, optimal: float) -> float:
    if optimal == 0:
        return 0.0 if actual == 0 else float("inf")
    return (actual - optimal) / abs(optimal)


def compute_requirement_satisfaction(
    result: ExecutionResult,
    scenario: ScenarioSpec,
) -> RequirementSatisfaction:
    """Check boolean requirement satisfaction for a result."""
    if result.error or not result.assignments:
        return RequirementSatisfaction(satisfaction_rate=0.0)

    rider_map = {r.id: r for r in scenario.riders}
    vehicle_map = {v.id: v for v in scenario.vehicles}
    assignment_map = {a["rider_id"]: a["vehicle_id"] for a in result.assignments
                      if "rider_id" in a and "vehicle_id" in a}

    checks = {}
    total = 0
    passed = 0

    # Check: occupied vehicles not assigned
    occupied_vehicles = {v.id for v in scenario.vehicles if v.is_occupied}
    if occupied_vehicles:
        assigned_to_occupied = any(
            vid in occupied_vehicles for vid in assignment_map.values()
        )
        checks["occupied_filtered"] = not assigned_to_occupied
        total += 1
        passed += int(not assigned_to_occupied)

    # Check: capacity respected
    oversized = [r for r in scenario.riders if r.party_size > 1]
    if oversized:
        capacity_ok = True
        for rider in oversized:
            vid = assignment_map.get(rider.id)
            if vid and vid in vehicle_map:
                if vehicle_map[vid].capacity < rider.party_size:
                    capacity_ok = False
                    break
        checks["capacity_checked"] = capacity_ok
        total += 1
        passed += int(capacity_ok)

    # Check: accessibility honored
    needs_accessible = [r for r in scenario.riders if r.needs_accessible]
    if needs_accessible:
        acc_ok = True
        for rider in needs_accessible:
            vid = assignment_map.get(rider.id)
            if vid and vid in vehicle_map:
                if not vehicle_map[vid].is_accessible:
                    acc_ok = False
                    break
        checks["accessibility_honored"] = acc_ok
        total += 1
        passed += int(acc_ok)

    # Check: all eligible vehicles considered (at least assigned from eligible pool)
    for rider_id, vehicle_id in assignment_map.items():
        if rider_id in rider_map and vehicle_id in vehicle_map:
            rider = rider_map[rider_id]
            vehicle = vehicle_map[vehicle_id]
            if not is_eligible(vehicle, rider):
                checks["all_vehicles_considered"] = False
                total += 1
                break
    else:
        if assignment_map:
            checks["all_vehicles_considered"] = True
            total += 1
            passed += 1

    rate = passed / total if total > 0 else 1.0

    return RequirementSatisfaction(
        occupied_filtered=checks.get("occupied_filtered"),
        capacity_checked=checks.get("capacity_checked"),
        accessibility_honored=checks.get("accessibility_honored"),
        all_vehicles_considered=checks.get("all_vehicles_considered"),
        satisfaction_rate=round(rate, 3),
    )
