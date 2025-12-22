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
        
        # Variables
        self.count = None
        self.time = None
        self.batch = None
        self.traffic = None
        self.revenue = None
    
        # State
        self.vehicles = []
        self.requests = []

