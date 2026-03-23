"""Scenario generation: deterministic corpus + Monte Carlo variants."""

import random
import copy
from .models import RiderSpec, VehicleSpec, ScenarioSpec
from .boundary_tests import build_boundary_scenarios
from .optimal import solve_optimal


def generate_scenario_corpus(seed: int = 42) -> list[ScenarioSpec]:
    """Generate the full boundary scenario corpus with optimal solutions."""
    scenarios = build_boundary_scenarios()
    for s in scenarios:
        s.seed = seed
        assignment, metrics = solve_optimal(s)
        s.optimal_assignment = assignment
        s.optimal_metrics = metrics
    return scenarios


def expand_with_variants(
    scenarios: list[ScenarioSpec],
    k: int = 30,
    seed: int = 42,
) -> list[ScenarioSpec]:
    """Expand each scenario into k Monte Carlo variants.

    Perturbations applied (seeded):
    - Jitter rider pickup/dropoff coordinates by +/-1 (clamped to 0-29)
    - Jitter vehicle locations by +/-1
    - Shuffle rider arrival order (permute request_times)
    - Randomly toggle one vehicle's occupied status
    """
    rng = random.Random(seed)
    expanded = []

    for scenario in scenarios:
        # Include the original
        expanded.append(scenario)

        for vi in range(k - 1):
            variant = copy.deepcopy(scenario)
            variant_seed = rng.randint(0, 2**31)
            variant.id = f"{scenario.id}_v{vi + 1}"
            variant.seed = variant_seed
            vrng = random.Random(variant_seed)

            # Jitter rider locations
            for rider in variant.riders:
                rider.pickup_location = _jitter(rider.pickup_location, vrng)
                rider.dropoff_location = _jitter(rider.dropoff_location, vrng)

            # Jitter vehicle locations
            for vehicle in variant.vehicles:
                vehicle.location = _jitter(vehicle.location, vrng)

            # Shuffle request times (permute order among riders)
            times = [r.request_time for r in variant.riders]
            vrng.shuffle(times)
            for r, t in zip(variant.riders, times):
                r.request_time = t

            # Randomly toggle one vehicle's occupied status (10% chance)
            if variant.vehicles and vrng.random() < 0.1:
                v = vrng.choice(variant.vehicles)
                v.is_occupied = not v.is_occupied

            # Recompute optimal for the variant
            assignment, metrics = solve_optimal(variant)
            variant.optimal_assignment = assignment
            variant.optimal_metrics = metrics

            expanded.append(variant)

    return expanded


def _jitter(coord: tuple[int, int], rng: random.Random) -> tuple[int, int]:
    x = max(0, min(29, coord[0] + rng.choice([-1, 0, 1])))
    y = max(0, min(29, coord[1] + rng.choice([-1, 0, 1])))
    return (x, y)
