"""
PSEUDOCODE: Configurable Rideshare Simulation System
This file defines how to configure simulations with different algorithms, 
bug injections, and attribute testing based on frontend selections.
"""

# ============================================================================
# CONFIGURATION STRUCTURE
# ============================================================================

class SimulationConfig:
    """
    Configuration object that defines how the simulation should run
    """
    def __init__(self, frontend_selections):
        self.algorithm_type = "batch"  # or "greedy"
        self.bug_injection_points = []
        self.test_attributes = []
        self.entity_targets = []  # which entities to test (rider_1, vehicle_2, system)
        
        # Parse frontend selections into test configuration
        for selection in frontend_selections:
            entity_type = selection.category  # e.g., "rider_1", "vehicle_2", "system"
            attribute = selection.attribute   # e.g., "pickup_location", "eta_car"
            
            self.entity_targets.append(entity_type)
            self.test_attributes.append({
                'entity': entity_type,
                'attribute': attribute,
                'bug_enabled': False,
                'bug_type': None
            })


# ============================================================================
# ALGORITHM STRATEGIES
# ============================================================================

class MatchingAlgorithm:
    """Base class for matching algorithms"""
    
    def match(self, vehicles, requests, time, config):
        """Override in subclasses"""
        pass


class GreedyAlgorithm(MatchingAlgorithm):
    """
    Greedy matching: assign each request to nearest available vehicle immediately
    """
    def match(self, vehicles, requests, time, config):
        assignments = []
        
        # Sort requests by arrival time
        sorted_requests = sort_by(requests, 'time_request')
        
        for request in sorted_requests:
            # Find available vehicles
            available_vehicles = filter(vehicles, lambda v: not v.is_occupied and not v.is_assigned)
            
            # Check for accessibility requirement
            if request.accessible:
                available_vehicles = filter(available_vehicles, lambda v: v.is_accessible)
            
            # BUG INJECTION POINT: "available_vehicle_filter"
            if config.has_bug('available_vehicle_filter'):
                available_vehicles = inject_bug_filter_vehicles(available_vehicles, config)
            
            # Find closest vehicle
            best_vehicle = None
            min_distance = infinity
            
            for vehicle in available_vehicles:
                distance = calculate_distance(vehicle.location, request.origin)
                
                # BUG INJECTION POINT: "pickup_distance"
                if config.has_bug('pickup_distance'):
                    distance = inject_bug_distance(distance, config)
                
                if distance < min_distance:
                    min_distance = distance
                    best_vehicle = vehicle
            
            # Assign if found
            if best_vehicle:
                assignments.append({
                    'vehicle': best_vehicle,
                    'request': request,
                    'pickup_distance': min_distance
                })
                best_vehicle.is_assigned = True
        
        return assignments


class BatchAlgorithm(MatchingAlgorithm):
    """
    Batch matching: collect requests over interval, optimize assignments together
    """
    def match(self, vehicles, requests, time, config):
        assignments = []
        
        # Get all available vehicles
        available_vehicles = filter(vehicles, lambda v: not v.is_occupied and not v.is_assigned)
        
        # Build cost matrix
        cost_matrix = []
        for request in requests:
            row = []
            for vehicle in available_vehicles:
                # Calculate cost for this pairing
                pickup_dist = calculate_distance(vehicle.location, request.origin)
                ride_dist = calculate_distance(request.origin, request.destination)
                
                # BUG INJECTION POINT: "distance_calculation"
                if config.has_bug('distance_calculation'):
                    pickup_dist = inject_bug_distance(pickup_dist, config)
                    ride_dist = inject_bug_distance(ride_dist, config)
                
                # Calculate time estimates
                pickup_time = estimate_travel_time(pickup_dist, time)
                ride_time = estimate_travel_time(ride_dist, time)
                
                # BUG INJECTION POINT: "eta_calculation"
                if config.has_bug('eta_calculation'):
                    pickup_time = inject_bug_eta(pickup_time, config)
                
                # Calculate profitability
                revenue, profit = calculate_trip_financials(
                    pickup_dist, pickup_time, 
                    ride_dist, ride_time
                )
                
                # BUG INJECTION POINT: "profit_calculation"
                if config.has_bug('profit_calculation'):
                    profit = inject_bug_profit(profit, config)
                
                # Check accessibility constraint
                if request.accessible and not vehicle.is_accessible:
                    cost = infinity  # Invalid pairing
                else:
                    # Cost function: minimize pickup time, maximize profit
                    cost = pickup_time - (profit * 0.1)  # weight profit vs. time
                
                row.append(cost)
            
            cost_matrix.append(row)
        
        # BUG INJECTION POINT: "optimization_algorithm"
        if config.has_bug('optimization_algorithm'):
            optimal_assignment = inject_bug_optimizer(cost_matrix, config)
        else:
            # Run Hungarian algorithm or linear assignment
            optimal_assignment = solve_assignment_problem(cost_matrix)
        
        # Convert solution to assignments
        for request_idx, vehicle_idx in optimal_assignment:
            assignments.append({
                'vehicle': available_vehicles[vehicle_idx],
                'request': requests[request_idx],
                'pickup_distance': calculate_distance(
                    available_vehicles[vehicle_idx].location,
                    requests[request_idx].origin
                )
            })
        
        return assignments


# ============================================================================
# ATTRIBUTE HANDLERS
# ============================================================================

class AttributeHandler:
    """
    Handles testing and validation of specific attributes selected in frontend
    """
    
    def test_pickup_location(self, entity, config):
        """Test pickup location attribute"""
        if config.should_inject_bug('pickup_location'):
            # Inject wrong coordinates (e.g., out of service area)
            return random_location_outside_radius()
        else:
            # Normal behavior
            return generate_random_location_within_radius()
    
    def test_destination(self, entity, config):
        """Test destination attribute"""
        if config.should_inject_bug('destination'):
            # Make destination too far or invalid
            return location_at_distance(entity.origin, 100)  # 100 miles (too far)
        else:
            return generate_destination_lognormal()
    
    def test_eta_car(self, vehicle, request, config):
        """Test ETA calculation for car arrival"""
        distance = calculate_distance(vehicle.location, request.origin)
        time = estimate_travel_time(distance, current_time)
        
        if config.should_inject_bug('eta_car'):
            # Return dramatically wrong ETA
            return time * random(0.1, 3.0)  # off by 10-300%
        else:
            return time
    
    def test_accessible(self, request, config):
        """Test accessibility requirement"""
        if config.should_inject_bug('accessible'):
            # Always request accessible vehicle (stress test supply)
            return True
        else:
            return random_boolean(probability=0.2)  # 20% need accessible
    
    def test_occupied(self, vehicle, config):
        """Test occupied status tracking"""
        if config.should_inject_bug('occupied'):
            # Fail to update status (assign occupied vehicle)
            return False  # claim not occupied when it is
        else:
            return vehicle.is_occupied
    
    def test_batch(self, time, config):
        """Test batching interval"""
        if config.should_inject_bug('batch'):
            # Use wrong batch interval (too short or too long)
            return random_choice([1, 15])  # 1 sec or 15 sec instead of 5
        else:
            return 5  # normal 5 second interval
    
    def test_traffic_delay(self, route, time, config):
        """Test traffic calculation"""
        base_time = calculate_base_travel_time(route)
        
        if config.should_inject_bug('traffic_delay'):
            # Apply no traffic or extreme traffic randomly
            traffic_multiplier = random_choice([1.0, 3.0])  # none or 3x
        else:
            traffic_multiplier = get_realistic_traffic_multiplier(time)
        
        return base_time * traffic_multiplier


# ============================================================================
# BUG INJECTION SYSTEM
# ============================================================================

class BugInjector:
    """
    Injects bugs at specified points based on configuration
    """
    
    def __init__(self, config):
        self.config = config
        self.bug_types = {
            # Distance/location bugs
            'pickup_location': self.bug_wrong_location,
            'destination': self.bug_wrong_destination,
            'pickup_distance': self.bug_distance_calculation,
            
            # Time/ETA bugs
            'eta_car': self.bug_eta_calculation,
            'eta_destination': self.bug_eta_calculation,
            'request_time': self.bug_request_timing,
            
            # Vehicle status bugs
            'occupied': self.bug_vehicle_status,
            'assigned_other': self.bug_vehicle_status,
            'online': self.bug_vehicle_availability,
            
            # System-level bugs
            'batch': self.bug_batch_interval,
            'traffic_delay': self.bug_traffic_calculation,
            'num_vehicles': self.bug_vehicle_count,
            
            # Financial bugs
            'fare': self.bug_fare_calculation,
            'predicted_profit': self.bug_profit_calculation,
        }
    
    def inject(self, bug_point, value):
        """Inject bug at specified point"""
        if bug_point in self.config.bug_injection_points:
            bug_function = self.bug_types.get(bug_point)
            if bug_function:
                return bug_function(value)
        return value
    
    # Bug injection methods
    def bug_wrong_location(self, location):
        """Return invalid location"""
        return (-999, -999)  # impossible coordinates
    
    def bug_distance_calculation(self, distance):
        """Return wrong distance"""
        return distance * random_float(0.3, 2.5)  # off by 30-250%
    
    def bug_eta_calculation(self, eta):
        """Return wrong ETA"""
        return eta + random_float(-10, 30)  # off by up to 30 mins
    
    def bug_vehicle_status(self, status):
        """Return wrong vehicle status"""
        return not status  # flip the status
    
    def bug_batch_interval(self, interval):
        """Use wrong batch interval"""
        return random_choice([1, 20])  # too fast or too slow


# ============================================================================
# SIMULATION RUNNER
# ============================================================================

class ConfigurableSimulation:
    """
    Main simulation that uses configuration to run different scenarios
    """
    
    def __init__(self, config):
        self.config = config
        self.env = create_simpy_environment()
        
        # Select algorithm based on config
        if config.algorithm_type == "greedy":
            self.matcher = GreedyAlgorithm()
        elif config.algorithm_type == "batch":
            self.matcher = BatchAlgorithm()
        
        # Initialize bug injector
        self.bug_injector = BugInjector(config)
        
        # Initialize attribute handler
        self.attribute_handler = AttributeHandler()
        
        # Tracking metrics
        self.metrics = {
            'total_requests': 0,
            'fulfilled_requests': 0,
            'avg_pickup_time': 0,
            'avg_wait_time': 0,
            'total_revenue': 0,
            'failed_matches': 0,
            'accessibility_failures': 0
        }
    
    def run(self):
        """Execute simulation with current configuration"""
        
        # Initialize vehicles
        vehicles = []
        for i in range(self.config.num_vehicles):
            vehicle = Vehicle(
                location=random_location(),
                is_occupied=False,
                is_assigned=False,
                is_accessible=random_boolean(0.3)  # 30% accessible
            )
            
            # TEST SELECTED ATTRIBUTES: if user selected vehicle attributes
            if 'vehicle_1' in self.config.entity_targets or 'vehicle_2' in self.config.entity_targets:
                vehicle = self.apply_attribute_tests(vehicle, 'vehicle')
            
            vehicles.append(vehicle)
        
        # Simulation loop
        for time_step in range(self.config.sim_duration):
            # Generate requests for this time step
            if random() < self.config.request_probability:
                request = Request(
                    origin=self.attribute_handler.test_pickup_location(None, self.config),
                    destination=self.attribute_handler.test_destination(None, self.config),
                    accessible=self.attribute_handler.test_accessible(None, self.config),
                    time_request=time_step,
                    eta_pickup=0,  # will be calculated
                    eta_dropoff=0  # will be calculated
                )
                
                # TEST SELECTED ATTRIBUTES: if user selected rider attributes
                if 'rider_1' in self.config.entity_targets or 'rider_2' in self.config.entity_targets:
                    request = self.apply_attribute_tests(request, 'rider')
                
                self.pending_requests.append(request)
                self.metrics['total_requests'] += 1
            
            # Check if it's time to run matching algorithm
            batch_interval = self.attribute_handler.test_batch(time_step, self.config)
            
            if time_step % batch_interval == 0 and len(self.pending_requests) > 0:
                # Run matching algorithm
                assignments = self.matcher.match(
                    vehicles, 
                    self.pending_requests, 
                    time_step,
                    self.config
                )
                
                # Process assignments
                for assignment in assignments:
                    vehicle = assignment['vehicle']
                    request = assignment['request']
                    
                    # Calculate ETAs with potential bugs
                    pickup_time = self.attribute_handler.test_eta_car(vehicle, request, self.config)
                    
                    # Calculate ride time
                    ride_distance = calculate_distance(request.origin, request.destination)
                    ride_time = estimate_travel_time(ride_distance, time_step)
                    
                    # Apply traffic
                    traffic_delay = self.attribute_handler.test_traffic_delay(
                        (vehicle.location, request.origin, request.destination),
                        time_step,
                        self.config
                    )
                    
                    # Calculate financials
                    revenue, profit = calculate_trip_financials(
                        assignment['pickup_distance'],
                        pickup_time,
                        ride_distance,
                        ride_time + traffic_delay
                    )
                    
                    # Record metrics
                    self.metrics['fulfilled_requests'] += 1
                    self.metrics['total_revenue'] += revenue
                    self.metrics['avg_wait_time'] += pickup_time
                    
                    # Update vehicle status
                    vehicle.is_occupied = True
                    vehicle.location = request.destination
                    
                    # Schedule vehicle to become available again
                    schedule_event(time_step + pickup_time + ride_time, 
                                   lambda: vehicle.is_occupied = False)
                
                # Clear matched requests
                self.pending_requests = []
        
        # Calculate final metrics
        self.calculate_final_metrics()
        return self.metrics
    
    def apply_attribute_tests(self, entity, entity_type):
        """Apply frontend-selected attribute tests to entity"""
        for test_config in self.config.test_attributes:
            if test_config['entity'].startswith(entity_type):
                attribute = test_config['attribute']
                
                # Apply attribute handler test
                if hasattr(entity, attribute):
                    tested_value = getattr(self.attribute_handler, f"test_{attribute}")(
                        entity, 
                        self.config
                    )
                    setattr(entity, attribute, tested_value)
        
        return entity


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

def run_simulation_from_frontend(frontend_data):
    """
    Main entry point: receive frontend selections and run simulation
    
    frontend_data = {
        'selections': [
            {'category': 'rider_1', 'attribute': 'pickup_location'},
            {'category': 'vehicle_2', 'attribute': 'occupied'},
            {'category': 'system', 'attribute': 'batch'}
        ],
        'algorithm': 'batch',  # or 'greedy'
        'inject_bugs': True,
        'bug_targets': ['pickup_location', 'occupied']  # which attributes to break
    }
    """
    
    # Create configuration from frontend data
    config = SimulationConfig(frontend_data['selections'])
    config.algorithm_type = frontend_data['algorithm']
    
    # Set up bug injection based on selections
    if frontend_data['inject_bugs']:
        for bug_target in frontend_data['bug_targets']:
            config.bug_injection_points.append(bug_target)
    
    # Run simulation
    sim = ConfigurableSimulation(config)
    results = sim.run()
    
    # Return results to frontend
    return {
        'success': True,
        'metrics': results,
        'config_used': {
            'algorithm': config.algorithm_type,
            'bugs_injected': config.bug_injection_points,
            'attributes_tested': config.test_attributes
        }
    }


# ============================================================================
# TESTING SCENARIOS
# ============================================================================

def example_test_scenarios():
    """Examples of how to test different scenarios"""
    
    # SCENARIO 1: Test pickup location with greedy algorithm
    scenario_1 = {
        'selections': [
            {'category': 'rider_1', 'attribute': 'pickup_location'},
            {'category': 'vehicle_1', 'attribute': 'car_cur_location'}
        ],
        'algorithm': 'greedy',
        'inject_bugs': True,
        'bug_targets': ['pickup_location']  # inject wrong locations
    }
    
    # SCENARIO 2: Test batch matching with traffic delays
    scenario_2 = {
        'selections': [
            {'category': 'system', 'attribute': 'batch'},
            {'category': 'system', 'attribute': 'traffic_delay'}
        ],
        'algorithm': 'batch',
        'inject_bugs': True,
        'bug_targets': ['batch', 'traffic_delay']
    }
    
    # SCENARIO 3: Test vehicle status tracking
    scenario_3 = {
        'selections': [
            {'category': 'vehicle_1', 'attribute': 'occupied'},
            {'category': 'vehicle_2', 'attribute': 'assigned_other'}
        ],
        'algorithm': 'batch',
        'inject_bugs': True,
        'bug_targets': ['occupied']  # fail to track occupancy
    }
    
    # Run each scenario
    for i, scenario in enumerate([scenario_1, scenario_2, scenario_3], 1):
        print(f"\n=== SCENARIO {i} ===")
        results = run_simulation_from_frontend(scenario)
        print(f"Results: {results}")

