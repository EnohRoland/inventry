CREATE TABLE users (
  id uuid PRIMARY KEY, name varchar(100) NOT NULL, email varchar(254) UNIQUE NOT NULL,
  password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('admin','manager','staff','viewer')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE locations (id uuid PRIMARY KEY, name varchar(100) UNIQUE NOT NULL, description varchar(250) NOT NULL DEFAULT '');
CREATE TABLE suppliers (id uuid PRIMARY KEY, name varchar(100) UNIQUE NOT NULL, email varchar(254) NOT NULL DEFAULT '', phone varchar(40) NOT NULL DEFAULT '');
CREATE TABLE items (
  id uuid PRIMARY KEY, sku varchar(40) UNIQUE NOT NULL, name varchar(120) NOT NULL,
  category varchar(60) NOT NULL, unit varchar(30) NOT NULL, reorder_point integer NOT NULL CHECK (reorder_point >= 0),
  unit_cost numeric(12,2) NOT NULL CHECK (unit_cost >= 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE stock (
  item_id uuid NOT NULL REFERENCES items(id), location_id uuid NOT NULL REFERENCES locations(id),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0), PRIMARY KEY (item_id, location_id)
);
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY, number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id), location_id uuid NOT NULL REFERENCES locations(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','received','cancelled')),
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), received_at timestamptz
);
CREATE TABLE purchase_order_lines (
  order_id uuid NOT NULL REFERENCES purchase_orders(id), item_id uuid NOT NULL REFERENCES items(id),
  quantity integer NOT NULL CHECK (quantity > 0), unit_cost numeric(12,2) NOT NULL CHECK (unit_cost >= 0), PRIMARY KEY(order_id,item_id)
);
CREATE TABLE movements (
  id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES items(id), location_id uuid NOT NULL REFERENCES locations(id),
  type text NOT NULL CHECK (type IN ('receive','issue','adjust','transfer_in','transfer_out')),
  quantity integer NOT NULL CHECK (quantity <> 0), reason varchar(300) NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id), order_id uuid REFERENCES purchase_orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX movements_recent ON movements(created_at DESC);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
  entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_recent ON audit_events(created_at DESC);
