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