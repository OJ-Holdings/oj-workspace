-- ALL NAMES, ADDRESSES, IDs AND PROVIDER EVENTS HERE ARE SYNTHETIC.
insert into auth.users(id) values
 ('20000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000003'),
 ('20000000-0000-4000-8000-000000000004'),
 ('20000000-0000-4000-8000-000000000005'),
 ('20000000-0000-4000-8000-000000000006');

insert into public.oj_organizations(id,name) values
 ('10000000-0000-4000-8000-000000000001','SYNTHETIC OJ EXTERIOR'),
 ('10000000-0000-4000-8000-000000000002','SYNTHETIC OTHER ORG');
insert into public.oj_memberships(organization_id,user_id,role,display_name) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','owner','Synthetic Owner'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','member','Synthetic Member'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','viewer','Synthetic Viewer'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','member','Synthetic Revocable'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000006','owner','Synthetic Other Owner');

insert into public.oj_exterior_customers(
 organization_id,id,display_name,created_by
) values
 ('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Synthetic Customer One','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Synthetic Customer Two','20000000-0000-4000-8000-000000000006');

insert into public.oj_exterior_properties(
 organization_id,id,customer_id,address_text,created_by
) values
 ('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001','100 FICTIONAL ROAD','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000002','200 FICTIONAL ROAD','20000000-0000-4000-8000-000000000006');

insert into public.oj_exterior_legacy_links(
 organization_id,legacy_lead_id,customer_id,property_id,linked_by
) values
 ('10000000-0000-4000-8000-000000000001','legacy-lead:001',
  '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001','legacy-lead:002',
  '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001');

insert into public.oj_exterior_opportunities(
 organization_id,id,customer_id,property_id,legacy_lead_id,target_booking_id,created_by
) values
 ('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  'legacy-lead:001','legacy-booking:001','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  'legacy-lead:002','legacy-booking:002','20000000-0000-4000-8000-000000000001');

insert into public.oj_exterior_quotes(
 organization_id,id,opportunity_id,created_by
) values
 ('10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');

insert into public.oj_exterior_quote_versions(
 organization_id,id,quote_id,sequence,command_id,expected_revision,created_by,
 source_quote_cents,scope,subtotal_cents,discount_cents,price_cents,content_hash
) values
 ('10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',1,'b0000000-0000-4000-8000-000000000001',0,
  '20000000-0000-4000-8000-000000000001',22500,
  '[{"id":"line-1","service":"Window washing","unit":"pane","quantity":20,"unitPriceCents":1125}]'::jsonb,
  22500,0,22500,repeat('a',64)),
 ('10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000002',1,'b0000000-0000-4000-8000-000000000002',0,
  '20000000-0000-4000-8000-000000000001',25000,
  '[{"id":"line-2","service":"Window washing old scope","unit":"pane","quantity":20,"unitPriceCents":1250}]'::jsonb,
  25000,0,25000,repeat('b',64));

insert into public.oj_exterior_quote_claims(
 organization_id,id,quote_id,version_id,booking_id,kind,reference,recorded_by
) values
 ('10000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
  'legacy-booking:001','operator-report','Synthetic operator recalls a yes','20000000-0000-4000-8000-000000000001');

insert into oj_private.oj_exterior_verified_acceptances(
 organization_id,id,quote_id,version_id,booking_id,content_hash,price_cents,
 issuer,provider_event_id,verified_at
) values
 ('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
  'legacy-booking:001',repeat('a',64),22500,'synthetic-provider','event_000000001',now()),
 ('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000002',
  'legacy-booking:002',repeat('b',64),25000,'synthetic-provider','event_000000002',now());

-- Current first-visit order; consumes receipt1 in the same transaction.
insert into public.oj_exterior_work_orders(
 organization_id,id,opportunity_id,quote_id,version_id,booking_id,
 verified_receipt_id,price_cents,scope_snapshot
) values (
 '10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',
 '70000000-0000-4000-8000-000000000001','legacy-booking:001',
 '90000000-0000-4000-8000-000000000001',22500,
 '[{"id":"line-1","service":"Window washing","unit":"pane","quantity":20,"unitPriceCents":1125}]'::jsonb
);

-- Later version supersedes quote2's old synthetic acceptance receipt2.
insert into public.oj_exterior_quote_versions(
 organization_id,id,quote_id,sequence,command_id,expected_revision,created_by,
 source_quote_cents,scope,subtotal_cents,discount_cents,price_cents,content_hash
) values (
 '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000003',
 '60000000-0000-4000-8000-000000000002',2,'b0000000-0000-4000-8000-000000000003',1,
 '20000000-0000-4000-8000-000000000001',30000,
 '[{"id":"line-3","service":"Window washing revised","unit":"pane","quantity":20,"unitPriceCents":1500}]'::jsonb,
 30000,0,30000,repeat('c',64)
);

insert into oj_private.oj_exterior_verified_acceptances(
 organization_id,id,quote_id,version_id,booking_id,content_hash,price_cents,
 issuer,provider_event_id,verified_at
) values (
 '10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003',
 '60000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003',
 'legacy-booking:002',repeat('c',64),30000,'synthetic-provider','event_000000003',now()
);
