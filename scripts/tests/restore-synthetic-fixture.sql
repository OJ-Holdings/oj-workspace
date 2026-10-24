-- SYNTHETIC ONLY: PostgreSQL 17 fixture for isolated recovery verification.
-- Contains no customer data, keys, tokens or actual production records.
CREATE SCHEMA auth;
CREATE TABLE auth.users(id text PRIMARY KEY);
CREATE TABLE public.leads(id text PRIMARY KEY);
CREATE TABLE public.bookings(id text PRIMARY KEY,lead_id text REFERENCES public.leads(id));
CREATE TABLE public.oj_memberships(id text PRIMARY KEY);
CREATE TABLE public.oj_cards(id text PRIMARY KEY);
CREATE TABLE public.oj_comments(id text PRIMARY KEY);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oj_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oj_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oj_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_fixture ON public.leads FOR SELECT TO public USING (true);
CREATE POLICY bookings_fixture ON public.bookings FOR SELECT TO public USING (true);
CREATE POLICY memberships_fixture ON public.oj_memberships FOR SELECT TO public USING (true);
CREATE POLICY cards_fixture ON public.oj_cards FOR SELECT TO public USING (true);
CREATE POLICY comments_fixture ON public.oj_comments FOR SELECT TO public USING (true);
INSERT INTO auth.users(id) VALUES('synthetic-auth');
INSERT INTO public.leads(id) VALUES('synthetic-lead');
INSERT INTO public.bookings(id,lead_id) VALUES('synthetic-booking','synthetic-lead');
INSERT INTO public.oj_memberships(id) VALUES('synthetic-membership');
INSERT INTO public.oj_cards(id) VALUES('synthetic-card');
INSERT INTO public.oj_comments(id) VALUES('synthetic-comment');
