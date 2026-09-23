#!/usr/bin/env python3
"""Spring collector 문서 계약의 경계 불변조건만 확인하는 오프라인 모델.

애플리케이션 source나 실제 Core API를 시험하는 테스트가 아니다.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta


@dataclass
class Candidate:
    status: str = "RUNNING"
    execution_id: str = "exec-current"
    version: int = 4
    attempt_count: int = 1
    preview_hash: str | None = None


def reserve(budget: dict[str, int], receipts: dict[str, int], key: str) -> int:
    if key in receipts:
        return receipts[key]
    budget["count"] += 1
    receipts[key] = budget["count"]
    return receipts[key]


def require_owner(candidate: Candidate, execution_id: str, version: int) -> None:
    if (execution_id, version) != (candidate.execution_id, candidate.version):
        raise ValueError("CANDIDATE_EXECUTION_CONFLICT")


def upload_preview(candidate: Candidate, request_key: str, payload_hash: str,
                   receipts: dict[str, tuple[str, int]]) -> tuple[str, int]:
    if request_key in receipts:
        return receipts[request_key]
    if candidate.status != "NEW":
        raise ValueError("CANDIDATE_STATE_CONFLICT")
    candidate.preview_hash = payload_hash
    candidate.version += 1
    receipts[request_key] = (payload_hash, candidate.version)
    return receipts[request_key]


def reclaim(candidate: Candidate) -> str:
    if candidate.attempt_count >= 3:
        candidate.status = "FETCH_FAILED"
        return "LEASE_EXPIRED"
    candidate.attempt_count += 1
    candidate.execution_id = f"exec-{candidate.attempt_count}"
    candidate.version += 1
    return "RECLAIMED"


def replayable(created_at: datetime, now: datetime) -> bool:
    return now < created_at + timedelta(days=7)


def run() -> None:
    budget, quota_receipts = {"count": 0}, {}
    assert reserve(budget, quota_receipts, "same") == 1
    assert reserve(budget, quota_receipts, "same") == 1
    assert budget["count"] == 1

    candidate = Candidate()
    try:
        require_owner(candidate, "exec-old", 4)
        raise AssertionError("stale execution accepted")
    except ValueError as error:
        assert str(error) == "CANDIDATE_EXECUTION_CONFLICT"

    candidate = Candidate(status="NEW")
    preview_receipts: dict[str, tuple[str, int]] = {}
    first = upload_preview(candidate, "preview-1", "sha256:a", preview_receipts)
    replay = upload_preview(candidate, "preview-1", "sha256:a", preview_receipts)
    assert first == replay == ("sha256:a", 5)
    assert candidate.version == 5

    candidate = Candidate(attempt_count=2)
    assert reclaim(candidate) == "RECLAIMED" and candidate.attempt_count == 3
    assert reclaim(candidate) == "LEASE_EXPIRED" and candidate.status == "FETCH_FAILED"

    created = datetime(2026, 9, 1, tzinfo=UTC)
    assert replayable(created, created + timedelta(days=7) - timedelta(microseconds=1))
    assert not replayable(created, created + timedelta(days=7))

    print("spring_collector_model_checks=5 issues=0")


if __name__ == "__main__":
    run()
