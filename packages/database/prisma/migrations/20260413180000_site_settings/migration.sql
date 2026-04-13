-- CreateTable
CREATE TABLE IF NOT EXISTS shared.site_settings (
    id VARCHAR(20) NOT NULL DEFAULT 'default',
    settings JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    CONSTRAINT site_settings_pkey PRIMARY KEY (id)
);
