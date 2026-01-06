# Mock Data from Frontend UI

## Simulation State

### Vehicle
- Car: (5, 4)

### Riders
- R1: (14, 12), T+0 min
- R2: (15, 15), T+0 min

## Stakeholder-Attribute-Value Pairs
- rider_1: request_time = T+0
- rider_2: request_time = T+4
- rider_1: pickup_location = (15, 15)
- rider_2: pickup_location = (14, 12)
- rider_2: destination = (15, 15)
- vehicle_current_location = (5, 4)

## Stakeholder-Attribute Pairs (Selectable)
- Rider 1: request_time
- Rider 1: pickup_location
- Rider 2: pickup_location
- Rider 2: request_time
- Vehicle 1: car_cur_location

## Test Case Selection
- Rider 1: request_time = T+0

## Office Hour Chat

### Student Message 1
Here are my test cases:
- rider_1: request_time = T+0, pickup_location = (14, 12)
- rider_2: request_time = T+7, pickup_location = (15, 15)
- car_1: car_cur_location = (5, 4)
- batch_time = 5 mins

### Student Message 2
My code passed all of these tests, but there's still a bug. Can you help me write a test to find the bug?

### TA Assistant Oracle Response
Here is a good interaction test:
- rider_1: request_time = T+0
- rider_2: request_time = T+4
- rider_1: pickup_location = (15, 15)
- rider_2: pickup_location = (14, 12)
- rider_2: destination = (15, 15)
- vehicle_current_location = (5, 4)

### Student Message 3
Can you explain why? What do you think will happen vs. what should happen?

## Response Options (Multiple Choice)

1. "I think the bug is that the vehicle will be matched with rider_1, but since rider_2 is within batch period and on the way, it should match with rider_2 first."

2. "The bug is likely in how you calculate distances. The vehicle might be picking the rider with the shorter straight-line distance rather than considering the route."

3. "I think the issue is that your batch timing isn't working correctly, so rider_2's request isn't being considered in the same batch as rider_1."

