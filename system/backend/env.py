import simpy #type: ignore
from dataclasses import dataclass, field
from typing import Tuple, List, Dict, Optional, Any
import math
import random

@dataclass
class Request:
    id: str
    origin: Tuple[float, float]
    destination: Tuple[float, float]
    accessible: bool
    time_request: float
    eta_pickup: float = 0
    eta_dropoff: float = 0
    assigned_vehicle: Optional[str] = None
    status: str = "pending"  # pending, assigned, picked_up, completed, cancelled

@dataclass
class Vehicle:
    id: str
    location: Tuple[float, float]
    is_occupied: bool = False
    is_assigned: bool = False
    is_accessible: bool = False
    assigned_to: Optional[str] = None
    battery: int = 100
    
@dataclass
class SimulationResult:
    test_passed: bool
    metrics: Dict[str, Any]
    assignments: List[Dict]
    bug_triggered: bool
    events: List[Dict]

class RidehailSystem:
    def __init__(self, num_vehicles: int, num_riders: int, disturbance: float):
        self.env = simpy.Environment()
        
        # Constants
        self.num_vehicles = num_vehicles
        self.num_riders = num_riders
        self.disturbance = disturbance
        
        # Simulation config
        self.sim_duration = 60  # seconds (1 sec = 1 min, total = 1 hour)
        self.request_probability = 0.67  # 67% chance per second
        self.batch_interval = 5  # seconds
        
        # Geographic config
        self.ride_radius = 10  # miles
        self.speed_highway = 60  # mph
        self.speed_city = 20  # mph
        self.dropoff_pickup_time = 2  # minutes
        
        # Lognormal distribution params
        self.dist_mean = 4.5  # miles
        self.dist_iqr = (1.25, 6)  # miles
        self.dist_max = 20  # miles
        self.dist_min = 0.25  # miles
        
        # Pricing constants
        self.base_fare = 7.50
        self.rate_per_mile = 1.70
        self.rate_per_min = 0.35
        self.ops_cost_per_mile = 0.40
        
        # Bug injection settings
        self.bug_enabled = False
        self.bug_type = None
        
        # State
        self.vehicles: List[Vehicle] = []
        self.requests: List[Request] = []
        self.pending_requests: List[Request] = []
        self.completed_requests: List[Request] = []
        self.events: List[Dict] = []
        
        # Metrics
        self.metrics = {
            "total_requests": 0,
            "fulfilled_requests": 0,
            "avg_wait_time": 0,
            "avg_pickup_time": 0,
            "total_revenue": 0,
            "failed_matches": 0,
            "accessibility_failures": 0
        }
    
    def calculate_distance(self, p1: Tuple[float, float], p2: Tuple[float, float], use_bug: bool = False) -> float:
        """Calculate distance between two points"""
        if use_bug and self.bug_type == "distance_calc":
            # BUG: Manhattan distance instead of Euclidean
            return abs(p2[0] - p1[0]) + abs(p2[1] - p1[1])
        else:
            # Correct: Euclidean distance
            return math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
    
    def estimate_travel_time(self, distance: float, current_time: float) -> float:
        """Estimate travel time with traffic consideration"""
        # Simple traffic model: slower during "rush hour" (time 15-30 and 45-60)
        is_rush = (15 <= current_time <= 30) or (45 <= current_time <= 60)
        speed = self.speed_city if is_rush else self.speed_highway
        return (distance / speed) * 60  # Convert to minutes
    
    def calculate_fare(self, pickup_dist: float, ride_dist: float, ride_time: float) -> Tuple[float, float]:
        """Calculate fare and profit for a trip"""
        fare = self.base_fare + (ride_dist * self.rate_per_mile) + (ride_time * self.rate_per_min)
        cost = (pickup_dist + ride_dist) * self.ops_cost_per_mile
        profit = fare - cost
        return fare, profit
    
    def find_best_vehicle(self, request: Request) -> Optional[Vehicle]:
        """Find best available vehicle for request (with potential bug injection)"""
        available = [v for v in self.vehicles if not v.is_occupied and not v.is_assigned]
        
        if request.accessible:
            if self.bug_enabled and self.bug_type == "accessibility_filter":
                # BUG: Filter accessible AFTER finding nearest (wrong order)
                pass  # Don't filter here
            else:
                # Correct: Filter accessible vehicles first
                available = [v for v in available if v.is_accessible]
        
        if not available:
            return None
        
        best = None
        min_dist = float('inf')
        
        for vehicle in available:
            dist = self.calculate_distance(
                vehicle.location, 
                request.origin, 
                use_bug=self.bug_enabled
            )
            if dist < min_dist:
                min_dist = dist
                best = vehicle
        
        # BUG: Apply accessibility filter after finding nearest
        if self.bug_enabled and self.bug_type == "accessibility_filter":
            if request.accessible and best and not best.is_accessible:
                # This is wrong - we found nearest but it's not accessible
                self.events.append({
                    "type": "bug_triggered",
                    "bug": "accessibility_filter",
                    "detail": f"Assigned non-accessible vehicle {best.id} to accessible request {request.id}"
                })
        
        return best
    
    def batch_matching(self, current_time: float):
        """Run batch matching algorithm"""
        if not self.pending_requests:
            return
        
        # BUG: Batch timing uses <= instead of <
        if self.bug_enabled and self.bug_type == "batch_timing":
            if current_time <= self.batch_interval:  # Wrong: should be <
                pass  # Process anyway
        
        assignments = []
        
        for request in list(self.pending_requests):
            best_vehicle = self.find_best_vehicle(request)
            
            if best_vehicle:
                # Check for status update bug
                if self.bug_enabled and self.bug_type == "status_update":
                    # BUG: Don't update status immediately (causes double assignment)
                    pass
                else:
                    best_vehicle.is_assigned = True
                    best_vehicle.assigned_to = request.id
                
                request.assigned_vehicle = best_vehicle.id
                request.status = "assigned"
                
                # Calculate ETAs
                pickup_dist = self.calculate_distance(best_vehicle.location, request.origin, self.bug_enabled)
                ride_dist = self.calculate_distance(request.origin, request.destination, self.bug_enabled)
                
                pickup_time = self.estimate_travel_time(pickup_dist, current_time)
                ride_time = self.estimate_travel_time(ride_dist, current_time + pickup_time)
                
                request.eta_pickup = current_time + pickup_time
                request.eta_dropoff = request.eta_pickup + ride_time
                
                fare, profit = self.calculate_fare(pickup_dist, ride_dist, ride_time)
                
                assignments.append({
                    "vehicle": best_vehicle.id,
                    "request": request.id,
                    "pickup_distance": pickup_dist,
                    "ride_distance": ride_dist,
                    "pickup_time": pickup_time,
                    "fare": fare,
                    "profit": profit
                })
                
                self.metrics["fulfilled_requests"] += 1
                self.metrics["total_revenue"] += fare
                self.metrics["avg_wait_time"] += pickup_time
                
                self.pending_requests.remove(request)
                
                self.events.append({
                    "time": current_time,
                    "type": "assignment",
                    "vehicle": best_vehicle.id,
                    "request": request.id,
                    "pickup_dist": pickup_dist
                })
        
        # Apply status updates after loop (correct behavior)
        if not (self.bug_enabled and self.bug_type == "status_update"):
            pass  # Already updated above
        else:
            # BUG: Update status after loop - too late!
            for assignment in assignments:
                vehicle = next((v for v in self.vehicles if v.id == assignment["vehicle"]), None)
                if vehicle:
                    vehicle.is_assigned = True
        
        return assignments
    
    def setup_from_test_cases(self, test_cases: List[Dict]):
        """Initialize simulation from frontend test case selections"""
        self.vehicles = []
        self.requests = []
        self.pending_requests = []
        
        # Parse test cases into vehicles and requests
        rider_data = {}
        vehicle_data = {}
        
        for tc in test_cases:
            stakeholder = tc.get("stakeholder", "")
            attribute = tc.get("attribute", "")
            value = tc.get("value", "")
            value2 = tc.get("value2", "")
            
            if stakeholder.startswith("rider"):
                if stakeholder not in rider_data:
                    rider_data[stakeholder] = {"id": stakeholder}
                    
                if attribute == "pickup_location" and value:
                    coords = [float(x.strip()) for x in value.split(",")]
                    rider_data[stakeholder]["origin"] = (coords[0], coords[1])
                elif attribute == "destination" and value:
                    coords = [float(x.strip()) for x in value.split(",")]
                    rider_data[stakeholder]["destination"] = (coords[0], coords[1])
                elif attribute == "accessible":
                    rider_data[stakeholder]["accessible"] = value == "true"
                elif attribute == "request_time" and value:
                    rider_data[stakeholder]["time_request"] = float(value)
                elif attribute == "cancels":
                    rider_data[stakeholder]["cancels"] = value == "true"
                    
            elif stakeholder.startswith("vehicle"):
                if stakeholder not in vehicle_data:
                    vehicle_data[stakeholder] = {"id": stakeholder}
                    
                if attribute == "car_current_location" and value:
                    coords = [float(x.strip()) for x in value.split(",")]
                    vehicle_data[stakeholder]["location"] = (coords[0], coords[1])
                elif attribute == "occupied":
                    vehicle_data[stakeholder]["is_occupied"] = value == "true"
                elif attribute == "assigned":
                    vehicle_data[stakeholder]["is_assigned"] = value == "true"
                    if value2:
                        vehicle_data[stakeholder]["assigned_to"] = value2
                elif attribute == "accessible":
                    vehicle_data[stakeholder]["is_accessible"] = value == "true"
                elif attribute == "battery" and value:
                    vehicle_data[stakeholder]["battery"] = int(value)
        
        # Create Vehicle objects
        for vid, vdata in vehicle_data.items():
            vehicle = Vehicle(
                id=vid,
                location=vdata.get("location", (random.uniform(0, 20), random.uniform(0, 20))),
                is_occupied=vdata.get("is_occupied", False),
                is_assigned=vdata.get("is_assigned", False),
                is_accessible=vdata.get("is_accessible", False),
                assigned_to=vdata.get("assigned_to"),
                battery=vdata.get("battery", 100)
            )
            self.vehicles.append(vehicle)
        
        # Create Request objects
        for rid, rdata in rider_data.items():
            request = Request(
                id=rid,
                origin=rdata.get("origin", (random.uniform(0, 20), random.uniform(0, 20))),
                destination=rdata.get("destination", (random.uniform(0, 20), random.uniform(0, 20))),
                accessible=rdata.get("accessible", False),
                time_request=rdata.get("time_request", 0)
            )
            self.requests.append(request)
            self.pending_requests.append(request)
        
        self.metrics["total_requests"] = len(self.requests)
    
    def inject_bug(self, bug_type: str):
        """Enable bug injection for testing"""
        self.bug_enabled = True
        self.bug_type = bug_type
    
    def run_simulation(self, test_cases: List[Dict], bug_type: Optional[str] = None) -> SimulationResult:
        """Run the complete simulation with given test cases"""
        # Setup
        self.setup_from_test_cases(test_cases)
        
        if bug_type:
            self.inject_bug(bug_type)
        
        # Run matching
        current_time = 0
        assignments = self.batch_matching(current_time)
        
        # Calculate final metrics
        if self.metrics["fulfilled_requests"] > 0:
            self.metrics["avg_wait_time"] /= self.metrics["fulfilled_requests"]
        
        # Determine if bug was triggered
        bug_triggered = any(e.get("type") == "bug_triggered" for e in self.events)
        
        # Determine test result
        test_passed = not bug_triggered
        
        return SimulationResult(
            test_passed=test_passed,
            metrics=self.metrics,
            assignments=assignments or [],
            bug_triggered=bug_triggered,
            events=self.events
        )
