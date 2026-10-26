import pytest
from app.services.video_sampling import evenly_spaced_sample_points

def test_default_sample_points_are_evenly_spaced():
    points = evenly_spaced_sample_points()
    assert len(points) == 30
    assert points[0].timestamp_seconds == 0
    assert points[-1].timestamp_seconds == 10
    gaps = [points[i+1].timestamp_seconds - points[i].timestamp_seconds for i in range(len(points)-1)]
    assert max(gaps) - min(gaps) < 1e-9

def test_invalid_sampling_values_rejected():
    with pytest.raises(ValueError): evenly_spaced_sample_points(0, 30)
    with pytest.raises(ValueError): evenly_spaced_sample_points(10, 1)
