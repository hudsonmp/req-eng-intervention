import simpy #type: ignore
from dataclasses import dataclass
from typing import Tuple

@dataclass
class Request:
    origin: Tuple[float, float]
    destination: Tuple[float, float]
    accessible: bool
    time_request: float
    eta_pickup: float
    eta_dropoff: float

@dataclass
class Vehicle:
    location: Tuple[float, float]
    is_occupied: bool
    is_assigned: bool
    is_accessible: bool

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
        self.dist_min=0.25 #miles
        
        # Pricing constants
        self.base_fare = 7.50
        self.rate_per_mile = 1.70
        self.rate_per_min = 0.35
        self.ops_cost_per_mile = 0.40
        
        # Variables
        self.count = None
        self.time = None
        self.batch = None
        self.traffic = None
        self.revenue = None
    
        # State
        self.vehicles = []
        self.requests = []
