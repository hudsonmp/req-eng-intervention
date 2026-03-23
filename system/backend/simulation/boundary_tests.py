"""28 handcrafted boundary-value scenarios for the prompt comparison simulation.

Each scenario is designed to test whether generated code handles a specific
attribute or requirement. Categories map to what the novice prompt omits.
"""

from .models import RiderSpec, VehicleSpec, ScenarioSpec


def _s(id: str, cat: str, riders: list[dict], vehicles: list[dict]) -> ScenarioSpec:
    return ScenarioSpec(
        id=id,
        category=cat,
        seed=0,
        riders=[RiderSpec(**r) for r in riders],
        vehicles=[VehicleSpec(**v) for v in vehicles],
    )


def build_boundary_scenarios() -> list[ScenarioSpec]:
    scenarios = []

    # ── basic_nearest (3): novice should handle these ──

    scenarios.append(_s("bn_1", "basic_nearest",
        riders=[{"id": "r1", "pickup_location": (15, 15), "dropoff_location": (20, 20), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (10, 15)},
            {"id": "v2", "location": (25, 15)},
        ],
    ))

    scenarios.append(_s("bn_2", "basic_nearest",
        riders=[{"id": "r1", "pickup_location": (5, 5), "dropoff_location": (10, 10), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (3, 3)},
            {"id": "v2", "location": (20, 20)},
            {"id": "v3", "location": (28, 28)},
        ],
    ))

    scenarios.append(_s("bn_3", "basic_nearest",
        riders=[
            {"id": "r1", "pickup_location": (0, 0), "dropoff_location": (5, 5), "request_time": 0},
            {"id": "r2", "pickup_location": (29, 29), "dropoff_location": (25, 25), "request_time": 0},
        ],
        vehicles=[
            {"id": "v1", "location": (1, 1)},
            {"id": "v2", "location": (28, 28)},
        ],
    ))

    # ── equidistant_tiebreak (4): novice has no tiebreak rule ──

    scenarios.append(_s("eq_1", "equidistant_tiebreak",
        riders=[{"id": "r1", "pickup_location": (10, 15), "dropoff_location": (20, 15), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (10, 10)},
            {"id": "v2", "location": (10, 20)},
        ],
    ))

    scenarios.append(_s("eq_2", "equidistant_tiebreak",
        riders=[{"id": "r1", "pickup_location": (15, 15), "dropoff_location": (20, 20), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (10, 15)},
            {"id": "v2", "location": (20, 15)},
            {"id": "v3", "location": (15, 10)},
        ],
    ))

    scenarios.append(_s("eq_3", "equidistant_tiebreak",
        riders=[
            {"id": "r1", "pickup_location": (15, 15), "dropoff_location": (20, 20), "request_time": 0},
            {"id": "r2", "pickup_location": (15, 15), "dropoff_location": (10, 10), "request_time": 1},
        ],
        vehicles=[
            {"id": "v1", "location": (10, 15)},
            {"id": "v2", "location": (20, 15)},
        ],
    ))

    scenarios.append(_s("eq_4", "equidistant_tiebreak",
        riders=[{"id": "r1", "pickup_location": (0, 0), "dropoff_location": (5, 5), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (2, 0)},
            {"id": "v2", "location": (0, 2)},
        ],
    ))

    # ── occupied_vehicles (4): novice doesn't check occupancy ──

    scenarios.append(_s("occ_1", "occupied_vehicles",
        riders=[{"id": "r1", "pickup_location": (5, 5), "dropoff_location": (10, 10), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (5, 6), "is_occupied": True},
            {"id": "v2", "location": (20, 20), "is_occupied": False},
        ],
    ))

    scenarios.append(_s("occ_2", "occupied_vehicles",
        riders=[{"id": "r1", "pickup_location": (15, 15), "dropoff_location": (20, 20), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (15, 14), "is_occupied": True},
            {"id": "v2", "location": (15, 16), "is_occupied": True},
            {"id": "v3", "location": (25, 25), "is_occupied": False},
        ],
    ))

    scenarios.append(_s("occ_3", "occupied_vehicles",
        riders=[
            {"id": "r1", "pickup_location": (5, 5), "dropoff_location": (10, 10), "request_time": 0},
            {"id": "r2", "pickup_location": (25, 25), "dropoff_location": (20, 20), "request_time": 0},
        ],
        vehicles=[
            {"id": "v1", "location": (4, 5), "is_occupied": True},
            {"id": "v2", "location": (6, 5), "is_occupied": False},
            {"id": "v3", "location": (24, 25), "is_occupied": False},
        ],
    ))

    scenarios.append(_s("occ_4", "occupied_vehicles",
        riders=[{"id": "r1", "pickup_location": (10, 10), "dropoff_location": (15, 15), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (10, 10), "is_occupied": True},  # same location but occupied
            {"id": "v2", "location": (29, 29), "is_occupied": False},
        ],
    ))

    # ── party_size_capacity (3): novice ignores capacity ──

    scenarios.append(_s("cap_1", "party_size_capacity",
        riders=[{"id": "r1", "pickup_location": (10, 10), "dropoff_location": (15, 15), "request_time": 0, "party_size": 4}],
        vehicles=[
            {"id": "v1", "location": (10, 11), "capacity": 2},
            {"id": "v2", "location": (20, 20), "capacity": 5},
        ],
    ))

    scenarios.append(_s("cap_2", "party_size_capacity",
        riders=[
            {"id": "r1", "pickup_location": (5, 5), "dropoff_location": (10, 10), "request_time": 0, "party_size": 3},
            {"id": "r2", "pickup_location": (25, 25), "dropoff_location": (20, 20), "request_time": 0, "party_size": 1},
        ],
        vehicles=[
            {"id": "v1", "location": (5, 6), "capacity": 2},
            {"id": "v2", "location": (6, 5), "capacity": 4},
            {"id": "v3", "location": (24, 25), "capacity": 1},
        ],
    ))

    scenarios.append(_s("cap_3", "party_size_capacity",
        riders=[{"id": "r1", "pickup_location": (15, 15), "dropoff_location": (20, 20), "request_time": 0, "party_size": 6}],
        vehicles=[
            {"id": "v1", "location": (15, 16), "capacity": 4},
            {"id": "v2", "location": (15, 14), "capacity": 4},
            {"id": "v3", "location": (25, 25), "capacity": 7},
        ],
    ))

    # ── multi_objective (4): distance-only is suboptimal for wait/travel ──

    scenarios.append(_s("mo_1", "multi_objective",
        riders=[{"id": "r1", "pickup_location": (15, 15), "dropoff_location": (28, 28), "request_time": 10}],
        vehicles=[
            {"id": "v1", "location": (14, 15)},  # nearest, but rider already waiting 10s
            {"id": "v2", "location": (12, 15)},  # slightly farther
        ],
    ))

    scenarios.append(_s("mo_2", "multi_objective",
        riders=[
            {"id": "r1", "pickup_location": (5, 5), "dropoff_location": (25, 25), "request_time": 0},   # long trip
            {"id": "r2", "pickup_location": (6, 5), "dropoff_location": (8, 5), "request_time": 0},     # short trip
        ],
        vehicles=[
            {"id": "v1", "location": (5, 4)},
            {"id": "v2", "location": (7, 5)},
        ],
    ))

    scenarios.append(_s("mo_3", "multi_objective",
        riders=[
            {"id": "r1", "pickup_location": (10, 10), "dropoff_location": (10, 29), "request_time": 0},
            {"id": "r2", "pickup_location": (10, 10), "dropoff_location": (10, 11), "request_time": 5},
        ],
        vehicles=[
            {"id": "v1", "location": (10, 9)},
            {"id": "v2", "location": (10, 8)},
        ],
    ))

    scenarios.append(_s("mo_4", "multi_objective",
        riders=[
            {"id": "r1", "pickup_location": (0, 0), "dropoff_location": (29, 29), "request_time": 0},
            {"id": "r2", "pickup_location": (1, 0), "dropoff_location": (2, 0), "request_time": 20},
        ],
        vehicles=[
            {"id": "v1", "location": (0, 1)},
            {"id": "v2", "location": (2, 0)},
        ],
    ))

    # ── batch_vs_greedy (3): simultaneous requests where greedy is suboptimal ──

    scenarios.append(_s("batch_1", "batch_vs_greedy",
        riders=[
            {"id": "r1", "pickup_location": (5, 5), "dropoff_location": (10, 10), "request_time": 0},
            {"id": "r2", "pickup_location": (6, 5), "dropoff_location": (11, 10), "request_time": 0},
            {"id": "r3", "pickup_location": (5, 6), "dropoff_location": (10, 11), "request_time": 0},
        ],
        vehicles=[
            {"id": "v1", "location": (5, 4)},
            {"id": "v2", "location": (7, 5)},
        ],
    ))

    scenarios.append(_s("batch_2", "batch_vs_greedy",
        riders=[
            {"id": "r1", "pickup_location": (0, 0), "dropoff_location": (5, 5), "request_time": 0},
            {"id": "r2", "pickup_location": (29, 29), "dropoff_location": (25, 25), "request_time": 0},
        ],
        vehicles=[
            {"id": "v1", "location": (1, 0)},   # greedy: v1->r1
            {"id": "v2", "location": (0, 1)},   # greedy: v2->? but r2 is far. Batch: v1->r1, v2->r2 might not help
        ],
    ))

    scenarios.append(_s("batch_3", "batch_vs_greedy",
        riders=[
            {"id": "r1", "pickup_location": (10, 10), "dropoff_location": (15, 15), "request_time": 0},
            {"id": "r2", "pickup_location": (11, 10), "dropoff_location": (16, 15), "request_time": 0},
            {"id": "r3", "pickup_location": (20, 20), "dropoff_location": (25, 25), "request_time": 0},
        ],
        vehicles=[
            {"id": "v1", "location": (10, 9)},
            {"id": "v2", "location": (11, 9)},
            {"id": "v3", "location": (19, 20)},
        ],
    ))

    # ── direction_aware (3): vehicle heading matters ──

    scenarios.append(_s("dir_1", "direction_aware",
        riders=[{"id": "r1", "pickup_location": (15, 20), "dropoff_location": (20, 25), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (15, 15), "current_direction": (0, 1)},   # heading toward rider
            {"id": "v2", "location": (15, 15), "current_direction": (0, -1)},  # heading away
        ],
    ))

    scenarios.append(_s("dir_2", "direction_aware",
        riders=[{"id": "r1", "pickup_location": (10, 10), "dropoff_location": (20, 10), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (5, 10), "current_direction": (1, 0)},    # heading toward
            {"id": "v2", "location": (5, 10), "current_direction": (-1, 0)},   # heading away
        ],
    ))

    scenarios.append(_s("dir_3", "direction_aware",
        riders=[{"id": "r1", "pickup_location": (20, 20), "dropoff_location": (25, 25), "request_time": 0}],
        vehicles=[
            {"id": "v1", "location": (15, 15), "current_direction": (1, 1), "destination": (25, 25)},  # passing through pickup
            {"id": "v2", "location": (18, 20), "current_direction": (-1, 0)},  # closer but heading away
        ],
    ))

    # ── accessibility (2): rider needs accessible vehicle ──

    scenarios.append(_s("acc_1", "accessibility",
        riders=[{"id": "r1", "pickup_location": (10, 10), "dropoff_location": (15, 15), "request_time": 0, "needs_accessible": True}],
        vehicles=[
            {"id": "v1", "location": (10, 11), "is_accessible": False},
            {"id": "v2", "location": (20, 20), "is_accessible": True},
        ],
    ))

    scenarios.append(_s("acc_2", "accessibility",
        riders=[
            {"id": "r1", "pickup_location": (5, 5), "dropoff_location": (10, 10), "request_time": 0, "needs_accessible": True},
            {"id": "r2", "pickup_location": (25, 25), "dropoff_location": (20, 20), "request_time": 0, "needs_accessible": False},
        ],
        vehicles=[
            {"id": "v1", "location": (5, 6), "is_accessible": False},
            {"id": "v2", "location": (6, 5), "is_accessible": True},
            {"id": "v3", "location": (24, 25), "is_accessible": False},
        ],
    ))

    # ── stress_test (2): full fleet, many riders ──

    scenarios.append(_s("stress_1", "stress_test",
        riders=[
            {"id": f"r{i}", "pickup_location": (i * 2, i * 2), "dropoff_location": (i * 2 + 5, i * 2 + 5), "request_time": i * 0.5}
            for i in range(10)
        ],
        vehicles=[
            {"id": f"v{i}", "location": (i * 3, i * 3 + 1)}
            for i in range(10)
        ],
    ))

    scenarios.append(_s("stress_2", "stress_test",
        riders=[
            {"id": f"r{i}", "pickup_location": (i * 2, 15), "dropoff_location": (29 - i * 2, 15), "request_time": i}
            for i in range(15)
        ],
        vehicles=[
            {"id": f"v{j}", "location": (j + 5, j + 3), "capacity": 4, "is_occupied": j % 5 == 0}
            for j in range(20)
        ],
    ))

    return scenarios
