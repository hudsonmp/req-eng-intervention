"""Statistical analysis: effect sizes, mixed models, per-category breakdown."""

import numpy as np
from scipy import stats
from dataclasses import dataclass, field


@dataclass
class MetricComparison:
    metric_name: str
    novice_mean: float
    novice_sd: float
    expert_mean: float
    expert_sd: float
    cohens_d: float
    ci_lower: float  # 95% CI for Cohen's d
    ci_upper: float
    p_value: float
    test_used: str  # "welch_t" or "mann_whitney"
    n_novice: int
    n_expert: int


@dataclass
class CategoryBreakdown:
    category: str
    n_scenarios: int
    cohens_d_distance: float
    cohens_d_wait: float
    cohens_d_travel: float
    novice_satisfaction_rate: float
    expert_satisfaction_rate: float


@dataclass
class AnalysisReport:
    metric_comparisons: list[MetricComparison] = field(default_factory=list)
    category_breakdowns: list[CategoryBreakdown] = field(default_factory=list)
    novice_parse_rate: float = 0.0
    expert_parse_rate: float = 0.0
    novice_error_rate: float = 0.0
    expert_error_rate: float = 0.0
    total_observations: int = 0


def cohens_d(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return 0.0
    pooled_sd = np.sqrt(((na - 1) * np.var(a, ddof=1) + (nb - 1) * np.var(b, ddof=1)) / (na + nb - 2))
    if pooled_sd == 0:
        return 0.0
    return (np.mean(a) - np.mean(b)) / pooled_sd


def bootstrap_ci_cohens_d(
    a: np.ndarray, b: np.ndarray, n_bootstrap: int = 10000, ci: float = 0.95, seed: int = 42
) -> tuple[float, float]:
    rng = np.random.RandomState(seed)
    ds = []
    for _ in range(n_bootstrap):
        a_boot = rng.choice(a, size=len(a), replace=True)
        b_boot = rng.choice(b, size=len(b), replace=True)
        ds.append(cohens_d(a_boot, b_boot))
    ds = np.array(ds)
    alpha = (1 - ci) / 2
    return float(np.percentile(ds, alpha * 100)), float(np.percentile(ds, (1 - alpha) * 100))


def compare_metric(
    name: str, novice_values: list[float], expert_values: list[float]
) -> MetricComparison:
    a = np.array(novice_values)
    b = np.array(expert_values)

    d = cohens_d(a, b)
    ci_lo, ci_hi = bootstrap_ci_cohens_d(a, b)

    # Normality check
    if len(a) >= 8 and len(b) >= 8:
        _, p_norm_a = stats.shapiro(a[:5000])  # cap for large samples
        _, p_norm_b = stats.shapiro(b[:5000])
        if p_norm_a > 0.05 and p_norm_b > 0.05:
            _, p_val = stats.ttest_ind(a, b, equal_var=False)
            test = "welch_t"
        else:
            _, p_val = stats.mannwhitneyu(a, b, alternative="two-sided")
            test = "mann_whitney"
    else:
        _, p_val = stats.mannwhitneyu(a, b, alternative="two-sided") if len(a) > 0 and len(b) > 0 else (0, 1.0)
        test = "mann_whitney"

    return MetricComparison(
        metric_name=name,
        novice_mean=float(np.mean(a)) if len(a) else 0,
        novice_sd=float(np.std(a, ddof=1)) if len(a) > 1 else 0,
        expert_mean=float(np.mean(b)) if len(b) else 0,
        expert_sd=float(np.std(b, ddof=1)) if len(b) > 1 else 0,
        cohens_d=d,
        ci_lower=ci_lo,
        ci_upper=ci_hi,
        p_value=float(p_val),
        test_used=test,
        n_novice=len(a),
        n_expert=len(b),
    )


def run_analysis(
    novice_results: list[dict],  # each: {scenario_id, category, metrics: MetricsBundle, satisfaction: RequirementSatisfaction}
    expert_results: list[dict],
    novice_parse_rate: float,
    expert_parse_rate: float,
    novice_error_rate: float,
    expert_error_rate: float,
) -> AnalysisReport:
    """Run full statistical analysis comparing novice vs expert results."""

    report = AnalysisReport(
        novice_parse_rate=novice_parse_rate,
        expert_parse_rate=expert_parse_rate,
        novice_error_rate=novice_error_rate,
        expert_error_rate=expert_error_rate,
        total_observations=len(novice_results) + len(expert_results),
    )

    # Collect metric values
    metric_names = [
        "total_pickup_distance", "avg_wait_time", "avg_travel_time",
        "unserved_riders", "revenue",
        "gap_to_optimal_distance", "gap_to_optimal_wait", "gap_to_optimal_travel",
    ]

    for name in metric_names:
        novice_vals = [r["metrics"].__dict__[name] for r in novice_results
                       if r["metrics"].__dict__[name] != float("inf")]
        expert_vals = [r["metrics"].__dict__[name] for r in expert_results
                       if r["metrics"].__dict__[name] != float("inf")]
        if novice_vals and expert_vals:
            report.metric_comparisons.append(compare_metric(name, novice_vals, expert_vals))

    # Per-category breakdown
    categories = sorted(set(r["category"] for r in novice_results + expert_results))
    for cat in categories:
        nov_cat = [r for r in novice_results if r["category"] == cat]
        exp_cat = [r for r in expert_results if r["category"] == cat]

        nov_dist = [r["metrics"].total_pickup_distance for r in nov_cat]
        exp_dist = [r["metrics"].total_pickup_distance for r in exp_cat]
        nov_wait = [r["metrics"].avg_wait_time for r in nov_cat]
        exp_wait = [r["metrics"].avg_wait_time for r in exp_cat]
        nov_trav = [r["metrics"].avg_travel_time for r in nov_cat]
        exp_trav = [r["metrics"].avg_travel_time for r in exp_cat]

        nov_sat = [r["satisfaction"].satisfaction_rate for r in nov_cat]
        exp_sat = [r["satisfaction"].satisfaction_rate for r in exp_cat]

        report.category_breakdowns.append(CategoryBreakdown(
            category=cat,
            n_scenarios=len(nov_cat) + len(exp_cat),
            cohens_d_distance=cohens_d(np.array(nov_dist), np.array(exp_dist)) if nov_dist and exp_dist else 0,
            cohens_d_wait=cohens_d(np.array(nov_wait), np.array(exp_wait)) if nov_wait and exp_wait else 0,
            cohens_d_travel=cohens_d(np.array(nov_trav), np.array(exp_trav)) if nov_trav and exp_trav else 0,
            novice_satisfaction_rate=float(np.mean(nov_sat)) if nov_sat else 0,
            expert_satisfaction_rate=float(np.mean(exp_sat)) if exp_sat else 0,
        ))

    return report
