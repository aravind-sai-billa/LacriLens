"""Provisional balanced sampling utility; validate against labeled clips."""
from dataclasses import dataclass

@dataclass(frozen=True)
class SamplePoint:
    frame_index: int
    timestamp_seconds: float

def evenly_spaced_sample_points(duration_seconds: float = 10.0, sample_count: int = 30) -> list[SamplePoint]:
    if duration_seconds <= 0:
        raise ValueError("duration_seconds must be positive")
    if sample_count < 2:
        raise ValueError("sample_count must be at least 2")
    return [SamplePoint(i, duration_seconds * i / (sample_count - 1)) for i in range(sample_count)]
