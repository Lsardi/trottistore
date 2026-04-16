-- Create invoices table (was in schema but never migrated to prod)
CREATE TABLE IF NOT EXISTS ecommerce.invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    invoice_number SERIAL NOT NULL,
    order_id UUID NOT NULL,
    order_number INTEGER NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_ttc DECIMAL(10, 2) NOT NULL,
    created_by UUID,
    CONSTRAINT invoices_pkey PRIMARY KEY (id),
    CONSTRAINT invoices_order_id_key UNIQUE (order_id),
    CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number),
    CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES ecommerce.orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS invoices_invoice_number_idx ON ecommerce.invoices (invoice_number);
