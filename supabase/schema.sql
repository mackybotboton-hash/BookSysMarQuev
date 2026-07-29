-- =====================================================
-- MarQuevedo Hair Studio - Database Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE (extends Supabase auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  gender TEXT DEFAULT 'Female',
  location TEXT DEFAULT 'Metro Manila',
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'staff', 'client')),
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup with full registration fields
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, gender, location, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'Female'),
    COALESCE(NEW.raw_user_meta_data->>'location', 'Metro Manila'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    gender = EXCLUDED.gender,
    location = EXCLUDED.location;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 2. SERVICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Hair', 'Nails', 'Other')),
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. STAFF TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  daily_rate NUMERIC(10,2) NOT NULL DEFAULT 400,
  color_code TEXT NOT NULL DEFAULT '#0A3D2E',
  is_active BOOLEAN DEFAULT TRUE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. BOOKINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  cancellation_reason TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. EXPENSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('salary', 'supplies', 'rent', 'utilities', 'other')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- PROFILES POLICIES ----
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (get_user_role() = 'admin');

-- ---- SERVICES POLICIES ----
CREATE POLICY "Anyone can view active services"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert services"
  ON services FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update services"
  ON services FOR UPDATE
  USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete services"
  ON services FOR DELETE
  USING (get_user_role() = 'admin');

-- ---- STAFF POLICIES ----
CREATE POLICY "Anyone can view staff"
  ON staff FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert staff"
  ON staff FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update staff"
  ON staff FOR UPDATE
  USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete staff"
  ON staff FOR DELETE
  USING (get_user_role() = 'admin');

-- ---- BOOKINGS POLICIES ----
CREATE POLICY "Anyone can view bookings"
  ON bookings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins and staff can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can update bookings" ON public.bookings;
CREATE POLICY "Anyone can update bookings" ON public.bookings FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete bookings"
  ON bookings FOR DELETE
  USING (get_user_role() = 'admin');

-- ---- EXPENSES POLICIES ----
CREATE POLICY "Admins can view expenses"
  ON expenses FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admins can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update expenses"
  ON expenses FOR UPDATE
  USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete expenses"
  ON expenses FOR DELETE
  USING (get_user_role() = 'admin');

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_staff ON bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);

-- =====================================================
-- 9. REVIEWS TABLE & POLICIES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reviews" ON public.reviews FOR INSERT WITH CHECK (true);

-- =====================================================
-- 10. SITE CONTENT TABLE (Live CMS Content & Sync)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.site_content (
  key TEXT PRIMARY KEY,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view site_content" ON public.site_content;
CREATE POLICY "Anyone can view site_content" ON public.site_content FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can upsert site_content" ON public.site_content;
CREATE POLICY "Anyone can upsert site_content" ON public.site_content FOR ALL USING (true);

-- =====================================================
-- 11. INVENTORY TABLES (Stock, Requisitions, Purchase Orders)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('backbar', 'retail')),
  type TEXT NOT NULL DEFAULT 'treatment',
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_threshold INTEGER NOT NULL DEFAULT 5,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  retail_price NUMERIC(10,2) DEFAULT 0.00,
  expiry_date DATE,
  supplier TEXT DEFAULT '',
  days_on_shelf INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view inventory_items" ON public.inventory_items;
CREATE POLICY "Anyone can view inventory_items" ON public.inventory_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and staff can manage inventory_items" ON public.inventory_items;
CREATE POLICY "Admins and staff can manage inventory_items" ON public.inventory_items FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.inventory_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  quantity_opened INTEGER NOT NULL DEFAULT 1,
  purpose TEXT DEFAULT 'Backbar station replenishment',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_requisitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view inventory_requisitions" ON public.inventory_requisitions;
CREATE POLICY "Anyone can view inventory_requisitions" ON public.inventory_requisitions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert inventory_requisitions" ON public.inventory_requisitions;
CREATE POLICY "Anyone can insert inventory_requisitions" ON public.inventory_requisitions FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  items_ordered JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'received')),
  delivery_days INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can manage purchase_orders" ON public.purchase_orders;
CREATE POLICY "Anyone can manage purchase_orders" ON public.purchase_orders FOR ALL USING (true);

-- =====================================================
-- 9. CALENDAR EVENTS TABLE (admin custom events)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can manage calendar_events" ON public.calendar_events;
CREATE POLICY "Anyone can manage calendar_events" ON public.calendar_events FOR ALL USING (true) WITH CHECK (true);
- -   C r e a t e   p u s h _ s u b s c r i p t i o n s   t a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . p u s h _ s u b s c r i p t i o n s   (  
         i d   U U I D   D E F A U L T   g e n _ r a n d o m _ u u i d ( )   P R I M A R Y   K E Y ,  
         u s e r _ i d   U U I D   R E F E R E N C E S   a u t h . u s e r s ( i d )   O N   D E L E T E   C A S C A D E ,  
         r o l e   T E X T   N O T   N U L L   D E F A U L T   ' c l i e n t ' ,  
         e n d p o i n t   T E X T   N O T   N U L L   U N I Q U E ,  
         p 2 5 6 d h   T E X T   N O T   N U L L ,  
         a u t h   T E X T   N O T   N U L L ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   D E F A U L T   t i m e z o n e ( ' u t c ' : : t e x t ,   n o w ( ) )   N O T   N U L L  
 ) ;  
  
 - -   E n a b l e   R L S  
 A L T E R   T A B L E   p u b l i c . p u s h _ s u b s c r i p t i o n s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 - -   P o l i c i e s  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   t h e i r   o w n   s u b s c r i p t i o n s "  
         O N   p u b l i c . p u s h _ s u b s c r i p t i o n s   F O R   S E L E C T  
         U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   i n s e r t   t h e i r   o w n   s u b s c r i p t i o n s "  
         O N   p u b l i c . p u s h _ s u b s c r i p t i o n s   F O R   I N S E R T  
         W I T H   C H E C K   ( a u t h . u i d ( )   =   u s e r _ i d ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   d e l e t e   t h e i r   o w n   s u b s c r i p t i o n s "  
         O N   p u b l i c . p u s h _ s u b s c r i p t i o n s   F O R   D E L E T E  
         U S I N G   ( a u t h . u i d ( )   =   u s e r _ i d ) ;  
  
 C R E A T E   P O L I C Y   " A d m i n s   c a n   v i e w   a l l   s u b s c r i p t i o n s "  
         O N   p u b l i c . p u s h _ s u b s c r i p t i o n s   F O R   S E L E C T  
         U S I N G   ( E X I S T S   (  
                 S E L E C T   1   F R O M   p r o f i l e s    
                 W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( )   A N D   p r o f i l e s . r o l e   =   ' a d m i n '  
         ) ) ;  
 