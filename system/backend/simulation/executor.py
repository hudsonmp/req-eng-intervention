"""Sandboxed execution of generated matching code against scenarios."""

import time
import multiprocessing
from .models import CodeSample, ScenarioSpec, ExecutionResult


def _run_in_sandbox(code: str, riders_data: list[dict], vehicles_data: list[dict], result_queue):
    """Execute generated code in an isolated namespace."""
    import math
    import itertools
    import collections

    namespace = {
        "math": math,
        "itertools": itertools,
        "collections": collections,
        "abs": abs,
        "min": min,
        "max": max,
        "len": len,
        "range": range,
        "enumerate": enumerate,
        "zip": zip,
        "sorted": sorted,
        "sum": sum,
        "float": float,
        "int": int,
        "str": str,
        "list": list,
        "dict": dict,
        "tuple": tuple,
        "set": set,
        "bool": bool,
        "None": None,
        "True": True,
        "False": False,
        "isinstance": isinstance,
        "print": lambda *a, **k: None,  # suppress output
    }

    try:
        exec(code, namespace)
        fn = namespace.get("match_riders_to_vehicles")
        if fn is None:
            result_queue.put({"error": "Function 'match_riders_to_vehicles' not found in generated code"})
            return
        result = fn(riders_data, vehicles_data)
        result_queue.put({"assignments": result})
    except Exception as e:
        result_queue.put({"error": f"{type(e).__name__}: {str(e)}"})


def execute_matching(
    code_sample: CodeSample,
    scenario: ScenarioSpec,
    timeout_sec: float = 5.0,
) -> ExecutionResult:
    """Execute a code sample against a scenario with timeout."""
    if code_sample.parsed_function is None:
        return ExecutionResult(
            code_sample_id=code_sample.id,
            scenario_id=scenario.id,
            error=f"Code failed to parse: {code_sample.parse_error}",
        )

    # Convert scenario to dicts (the format the generated code expects)
    riders_data = [
        {
            "id": r.id,
            "pickup_location": r.pickup_location,
            "dropoff_location": r.dropoff_location,
            "request_time": r.request_time,
            "party_size": r.party_size,
            "needs_accessible": r.needs_accessible,
        }
        for r in scenario.riders
    ]
    vehicles_data = [
        {
            "id": v.id,
            "location": v.location,
            "capacity": v.capacity,
            "is_occupied": v.is_occupied,
            "is_accessible": v.is_accessible,
            "current_direction": v.current_direction,
            "destination": v.destination,
            "assigned_rider": v.assigned_rider,
        }
        for v in scenario.vehicles
    ]

    result_queue = multiprocessing.Queue()
    process = multiprocessing.Process(
        target=_run_in_sandbox,
        args=(code_sample.parsed_function, riders_data, vehicles_data, result_queue),
    )

    start = time.perf_counter()
    process.start()
    process.join(timeout=timeout_sec)
    elapsed_ms = (time.perf_counter() - start) * 1000

    if process.is_alive():
        process.terminate()
        process.join(timeout=1)
        return ExecutionResult(
            code_sample_id=code_sample.id,
            scenario_id=scenario.id,
            timed_out=True,
            execution_time_ms=elapsed_ms,
            error="Execution timed out",
        )

    if result_queue.empty():
        return ExecutionResult(
            code_sample_id=code_sample.id,
            scenario_id=scenario.id,
            error="Process exited without result",
            execution_time_ms=elapsed_ms,
        )

    result = result_queue.get_nowait()

    if "error" in result:
        return ExecutionResult(
            code_sample_id=code_sample.id,
            scenario_id=scenario.id,
            error=result["error"],
            execution_time_ms=elapsed_ms,
        )

    return ExecutionResult(
        code_sample_id=code_sample.id,
        scenario_id=scenario.id,
        assignments=result["assignments"],
        execution_time_ms=elapsed_ms,
    )
