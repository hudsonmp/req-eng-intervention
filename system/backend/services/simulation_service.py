"""
Simulation Service - Wraps simulation_config.py to execute tests with bug injection.
Converts test cases to simulation format and detects bug symptoms.
"""

from typing import Dict, Any, List
import sys
import os

# Add parent directory to path to import simulation_config
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ..models import TestCase, TestResult


class SimulationService:
    """Wraps the existing simulation to execute tests with bug injection."""

    def __init__(self):
        pass

    def execute_test(
        self,
        test_case: TestCase,
        bug_level: str = 'primary'
    ) -> TestResult:
        """
        Execute a test case with specified bug injection level.

        Args:
            test_case: The test case with vehicles, riders, expected outcome
            bug_level: 'primary', 'secondary', or 'tertiary'

        Returns:
            TestResult with actual outcome and bugs triggered
        """
        # Convert test case to simulation input format
        sim_input = self._convert_test_to_simulation_input(test_case, bug_level)

        # Run simulation (mock for now - will integrate with actual simulation)
        results = self._run_simulation(sim_input)

        # Detect which bugs were triggered
        bugs_triggered = self._detect_bugs(results, test_case)

        # Format results for Alex to see
        actual_outcome = self._format_results(results)

        # Determine if test passed
        passed = (actual_outcome == test_case.expected_outcome)

        return TestResult(
            test_case=test_case,
            actual_outcome=actual_outcome,
            passed=passed,
            bugs_triggered=bugs_triggered,
            simulation_results=results
        )

    def _convert_test_to_simulation_input(
        self,
        test_case: TestCase,
        bug_level: str
    ) -> Dict[str, Any]:
        """
        Convert test case to simulation configuration format.
        """
        bug_targets = []
        if bug_level == 'primary':
            bug_targets = ['availability_not_updated']
        elif bug_level == 'secondary':
            bug_targets = ['availability_not_updated', 'reassignment_cleanup']
        elif bug_level == 'tertiary':
            bug_targets = ['availability_not_updated', 'reassignment_cleanup', 'race_condition']

        return {
            'vehicles': test_case.vehicles,
            'riders': test_case.riders,
            'algorithm': 'greedy',  # Default to greedy for simplicity
            'inject_bugs': True,
            'bug_targets': bug_targets,
            'time_start': 0
        }

    def _run_simulation(self, sim_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the actual simulation with the given input.

        For now, this is a mock implementation that simulates the primary bug:
        - Vehicles don't get marked as unavailable after assignment
        - Same vehicle can be assigned to multiple riders
        """
        vehicles = sim_input['vehicles']
        riders = sim_input['riders']
        bug_targets = sim_input.get('bug_targets', [])

        assignments = []

        # Simulate greedy matching
        for rider in riders:
            rider_location = rider.get('location', rider.get('origin', [0, 0]))

            # Find available vehicles (but with bug, we don't properly check)
            available_vehicles = [
                v for v in vehicles
                if not v.get('is_occupied', False)
            ]

            # Primary bug: We don't check is_assigned or is_available properly
            # So if a vehicle was just assigned, it's still "available"

            if not available_vehicles:
                continue

            # Find closest vehicle
            best_vehicle = None
            min_distance = float('inf')

            for vehicle in available_vehicles:
                vehicle_location = vehicle.get('location', [0, 0])
                distance = self._calculate_distance(vehicle_location, rider_location)

                if distance < min_distance:
                    min_distance = distance
                    best_vehicle = vehicle

            if best_vehicle:
                assignment = {
                    'vehicle_id': best_vehicle.get('id', 'unknown'),
                    'rider_id': rider.get('id', 'unknown'),
                    'pickup_distance': min_distance,
                    'vehicle_location': best_vehicle.get('location'),
                    'rider_location': rider_location
                }
                assignments.append(assignment)

                # PRIMARY BUG: We mark is_assigned but NOT is_available
                if 'availability_not_updated' in bug_targets:
                    best_vehicle['is_assigned'] = True
                    # BUG: Should also set is_available = False, but we don't!
                else:
                    # Correct behavior
                    best_vehicle['is_assigned'] = True
                    best_vehicle['is_available'] = False

        return {
            'assignments': assignments,
            'vehicles': vehicles,
            'riders': riders,
            'bugs_active': bug_targets
        }

    def _detect_bugs(
        self,
        results: Dict[str, Any],
        test_case: TestCase
    ) -> List[str]:
        """
        Detect which bugs were triggered based on results.
        """
        bugs_triggered = []

        assignments = results.get('assignments', [])

        # Check for primary bug: same vehicle assigned multiple times
        vehicle_ids = [a['vehicle_id'] for a in assignments]
        if len(vehicle_ids) != len(set(vehicle_ids)):
            bugs_triggered.append('availability_not_updated')

        # Check for other bug symptoms (implement as needed)
        # TODO: Add detection for secondary and tertiary bugs

        return bugs_triggered

    def _format_results(self, results: Dict[str, Any]) -> str:
        """
        Format simulation results in a human-readable way for Alex.
        """
        assignments = results.get('assignments', [])

        if not assignments:
            return "No vehicles were assigned."

        output_lines = []
        for assignment in assignments:
            vehicle_id = assignment['vehicle_id']
            rider_id = assignment['rider_id']
            distance = assignment['pickup_distance']
            output_lines.append(
                f"Vehicle {vehicle_id} assigned to Rider {rider_id} "
                f"(pickup distance: {distance:.2f} units)"
            )

        # Check for duplicates
        vehicle_ids = [a['vehicle_id'] for a in assignments]
        if len(vehicle_ids) != len(set(vehicle_ids)):
            duplicates = [vid for vid in vehicle_ids if vehicle_ids.count(vid) > 1]
            output_lines.append(
                f"\n⚠️  Warning: Vehicle(s) {set(duplicates)} assigned to multiple riders!"
            )

        return "\n".join(output_lines)

    def _calculate_distance(self, loc1: List[float], loc2: List[float]) -> float:
        """
        Calculate Euclidean distance between two locations.
        """
        return ((loc1[0] - loc2[0]) ** 2 + (loc1[1] - loc2[1]) ** 2) ** 0.5
