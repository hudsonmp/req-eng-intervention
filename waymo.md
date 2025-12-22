Given $n$ riders and $m$ vehicles at time $t$, find optimal assignment and adapt when systems fail.

Cost function:
- Distance between vehicles and rider pickup location
- ETA (pickup and dropoff)
- Predicted profitability
- Vehicle compatibility
- Traffic conditions

Use optimization for matching riders to vehicles.

Batching (t intervals) vs. greedy matching
B(t(m)) (batch is afunction of time which is a function of num of riders)

Write natural language pseudocode that concisely demonstrates the following optimization algorithm in under twenty lines of code:

\textbf{Variables:}
$n$ number\\
$t$ time\\
$p$ batch\\
$T$ traffic\\
$R$ revenue\\
\textbf{Constants:}\\
$n_v$ num vehicles\\
$n_r$ num riders\\
$\epsilon$ random disturbance\\


Goal: given $n_v$ and and $n_r$, minimize $t_{pickup}$, $t_{ride}$, and $\delta$ while maximizing $R_{actual}$ given $T$, $n_v$, $R_{projected}$, $\delta_{req}$ and $n_r$.\\

request$_i$ metadata:\\
- origin coordinates\\
- destination coordinates\\
- accessible (binary)\\
- time of request\\
- ETA pickup\\
- ETA dropoff\\
\\
vehicle$_i$ metadata:\\
- Current location\\
- Is occupied (binary)\\
- Is assigned another driver (binary)\\
- Is accessible (binary)\\


Poisson distribution
Simulation duration: 60 seconds (1 minute). Each second represents one minute, making the simulation representative of one hour

Probability of ride each second=0.67 -> 67%
Num cars = 20
Total requests = 50 minutes
Ride radius=10 miles
Zones= 60mph, 20mph, 2 mins dropoff/pickup
Use lognormal distribution where mean is 5 and IQR is [2,5, 8] and maximum is 20 miles
Batch interval=5 seconds
Revenue:
```def calculate_trip_financials(pickup_dist, pickup_time, ride_dist, ride_time):
    # --- PRICING CONSTANTS (San Francisco-ish style) ---
    BASE_FARE = 7.50
    RATE_PER_MILE = 1.70
    RATE_PER_MIN = 0.35
    
    # 1. Calculate Gross Revenue (Only from the ride portion)
    gross_revenue = BASE_FARE + (ride_dist * RATE_PER_MILE) + (ride_time * RATE_PER_MIN)
    
    # 2. Calculate Costs (Simplistic estimate: $0.40/mile ops cost)
    total_dist = pickup_dist + ride_dist
    ops_cost = total_dist * 0.40
    
    # 3. Net Profit for this specific trip
    net_profit = gross_revenue - ops_cost
    
    return round(gross_revenue, 2), round(net_profit, 2)

# Example: 2 mile pickup (5 mins), 5 mile ride (15 mins)
revenue, profit = calculate_trip_financials(2.0, 5.0, 5.0, 15.0)

print(f"Revenue: ${revenue}")
print(f"Profit:  ${profit}")```