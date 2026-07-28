-- =====================================================
-- MarQuevedo Hair Studio - Seed Data
-- =====================================================

-- ---- SEED SERVICES ----

-- Hair Services
INSERT INTO services (name, category, price, duration_minutes) VALUES
  ('Gupit Lalaki', 'Hair', 120.00, 30),
  ('Gupit Babae', 'Hair', 150.00, 45),
  ('Blowdry', 'Hair', 200.00, 30),
  ('Hair Color', 'Hair', 1200.00, 120),
  ('Rebond', 'Hair', 1500.00, 180),
  ('Brazilian Blowout', 'Hair', 1500.00, 150),
  ('Hair Spa', 'Hair', 500.00, 60);

-- Nail Services
INSERT INTO services (name, category, price, duration_minutes) VALUES
  ('Manicure', 'Nails', 120.00, 30),
  ('Pedicure', 'Nails', 150.00, 45),
  ('Gel Polish Hands', 'Nails', 400.00, 45),
  ('Gel Polish Feet', 'Nails', 450.00, 45),
  ('Nail Extensions', 'Nails', 1200.00, 90);

-- Other Services
INSERT INTO services (name, category, price, duration_minutes) VALUES
  ('Facial', 'Other', 600.00, 60),
  ('Eyebrow Threading', 'Other', 100.00, 15),
  ('Foot Spa', 'Other', 300.00, 45);

-- ---- SEED STAFF ----
INSERT INTO staff (name, daily_rate, color_code, phone) VALUES
  ('Staff 1', 400.00, '#0A3D2E', ''),
  ('Staff 2', 400.00, '#D4AF37', '');
