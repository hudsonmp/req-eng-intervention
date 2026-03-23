"""Orchestrates the full simulation pipeline."""

import uuid
import json
from anthropic import Anthropic
from .models import MetricsBundle, RequirementSatisfaction
from .scenarios import generate_scenario_corpus, expand_with_variants
from .codegen import generate_matching_code, NOVICE_PROMPT, EXPERT_PROMPT
from .executor import execute_matching
from .metrics import compute_metrics, compute_requirement_satisfaction
from .analysis import run_analysis, AnalysisReport


def run_simulation(
    client: Anthropic,
    seed: int = 42,
    n_code_samples: int = 10,
    k_variants: int = 30,
    model: str = "claude-sonnet-4-6",
) -> dict:
    """Run the full prompt comparison simulation.

    Returns a dict with:
    - run_id: str
    - novice_samples: list[CodeSample]
    - expert_samples: list[CodeSample]
    - scenarios: list[ScenarioSpec]
    - novice_results: list[dict]  (each has scenario_id, category, metrics, satisfaction)
    - expert_results: list[dict]
    - analysis: AnalysisReport
    """
    run_id = str(uuid.uuid4())

    # 1. Generate scenarios
    base_scenarios = generate_scenario_corpus(seed=seed)
    scenarios = expand_with_variants(base_scenarios, k=k_variants, seed=seed)

    # 2. Generate code from both prompts
    novice_samples = generate_matching_code(
        client, NOVICE_PROMPT, "novice", n=n_code_samples, model=model
    )
    expert_samples = generate_matching_code(
        client, EXPERT_PROMPT, "expert", n=n_code_samples, model=model
    )

    # 3. Execute all (code, scenario) pairs
    novice_results = []
    expert_results = []

    for samples, results_list in [(novice_samples, novice_results), (expert_samples, expert_results)]:
        for sample in samples:
            for scenario in scenarios:
                exec_result = execute_matching(sample, scenario)
                metrics = compute_metrics(exec_result, scenario)
                satisfaction = compute_requirement_satisfaction(exec_result, scenario)
                results_list.append({
                    "scenario_id": scenario.id,
                    "category": scenario.category,
                    "code_sample_id": sample.id,
                    "prompt_type": sample.prompt_type,
                    "metrics": metrics,
                    "satisfaction": satisfaction,
                    "error": exec_result.error,
                    "execution_time_ms": exec_result.execution_time_ms,
                })

    # 4. Compute parse/error rates
    novice_parse_rate = sum(1 for s in novice_samples if s.parsed_function) / len(novice_samples) if novice_samples else 0
    expert_parse_rate = sum(1 for s in expert_samples if s.parsed_function) / len(expert_samples) if expert_samples else 0
    novice_error_rate = sum(1 for r in novice_results if r["error"]) / len(novice_results) if novice_results else 0
    expert_error_rate = sum(1 for r in expert_results if r["error"]) / len(expert_results) if expert_results else 0

    # 5. Statistical analysis
    analysis = run_analysis(
        novice_results, expert_results,
        novice_parse_rate, expert_parse_rate,
        novice_error_rate, expert_error_rate,
    )

    return {
        "run_id": run_id,
        "seed": seed,
        "n_code_samples": n_code_samples,
        "k_variants": k_variants,
        "n_scenarios_total": len(scenarios),
        "novice_samples": novice_samples,
        "expert_samples": expert_samples,
        "novice_results": novice_results,
        "expert_results": expert_results,
        "analysis": analysis,
    }


def format_report(analysis: AnalysisReport) -> str:
    """Format analysis into a readable text report."""
    lines = []
    lines.append("=" * 60)
    lines.append("PROMPT COMPARISON SIMULATION REPORT")
    lines.append("=" * 60)

    lines.append(f"\nParse rates: novice={analysis.novice_parse_rate:.0%}, expert={analysis.expert_parse_rate:.0%}")
    lines.append(f"Error rates: novice={analysis.novice_error_rate:.0%}, expert={analysis.expert_error_rate:.0%}")
    lines.append(f"Total observations: {analysis.total_observations}")

    lines.append("\n--- METRIC COMPARISONS ---")
    for mc in analysis.metric_comparisons:
        lines.append(f"\n{mc.metric_name}:")
        lines.append(f"  Novice: {mc.novice_mean:.2f} (SD={mc.novice_sd:.2f}, n={mc.n_novice})")
        lines.append(f"  Expert: {mc.expert_mean:.2f} (SD={mc.expert_sd:.2f}, n={mc.n_expert})")
        lines.append(f"  Cohen's d: {mc.cohens_d:.3f} [{mc.ci_lower:.3f}, {mc.ci_upper:.3f}]")
        lines.append(f"  p={mc.p_value:.4f} ({mc.test_used})")

    lines.append("\n--- CATEGORY BREAKDOWN ---")
    lines.append(f"{'Category':<25} {'d(dist)':<10} {'d(wait)':<10} {'d(travel)':<10} {'Nov sat':<10} {'Exp sat':<10}")
    lines.append("-" * 75)
    for cb in analysis.category_breakdowns:
        lines.append(f"{cb.category:<25} {cb.cohens_d_distance:<10.3f} {cb.cohens_d_wait:<10.3f} {cb.cohens_d_travel:<10.3f} {cb.novice_satisfaction_rate:<10.3f} {cb.expert_satisfaction_rate:<10.3f}")

    return "\n".join(lines)
