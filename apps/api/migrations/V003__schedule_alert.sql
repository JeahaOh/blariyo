CREATE TABLE ops.schedule_failure_alert (
    post_id BIGINT NOT NULL REFERENCES content.board_post(id),
    scheduled_at TIMESTAMPTZ(3) NOT NULL,
    error_code VARCHAR(80) NOT NULL CHECK(error_code ~ '^[A-Z_]+$'),
    attempt_count INTEGER NOT NULL CHECK(attempt_count>0),
    first_attempt_at TIMESTAMPTZ(3) NOT NULL,
    last_attempt_at TIMESTAMPTZ(3) NOT NULL,
    notified_count INTEGER NOT NULL DEFAULT 0 CHECK(notified_count>=0 AND notified_count<=attempt_count),
    notified_at TIMESTAMPTZ(3),
    created_by VARCHAR(100) NOT NULL DEFAULT 'system:scheduler' CHECK(created_by='system:scheduler'),
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    updated_by VARCHAR(100) NOT NULL DEFAULT 'system:scheduler' CHECK(updated_by='system:scheduler'),
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    PRIMARY KEY(post_id,scheduled_at,error_code),
    CHECK(last_attempt_at>=first_attempt_at)
);
