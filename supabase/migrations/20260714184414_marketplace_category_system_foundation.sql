create table if not exists public.marketplace_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.marketplace_categories(id) on delete cascade,
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  icon_name text,
  offer_type text check (offer_type in ('sell', 'rent', 'service', 'request')),
  experience_key text not null default 'general'
    check (experience_key in ('general', 'vehicles', 'real_estate', 'electronics', 'livestock', 'jobs', 'services')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_category_fields (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.marketplace_categories(id) on delete cascade,
  field_key text not null,
  field_type text not null
    check (field_type in ('text', 'textarea', 'number', 'select', 'multiselect', 'boolean')),
  label_ar text not null,
  label_en text not null,
  placeholder_ar text,
  placeholder_en text,
  helper_text_ar text,
  helper_text_en text,
  is_required boolean not null default false,
  filterable boolean not null default false,
  detail_visible boolean not null default true,
  options_json jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, field_key)
);

create index if not exists marketplace_categories_parent_idx on public.marketplace_categories(parent_id);
create index if not exists marketplace_categories_offer_type_idx on public.marketplace_categories(offer_type);
create index if not exists marketplace_categories_active_sort_idx on public.marketplace_categories(is_active, sort_order);
create index if not exists marketplace_category_fields_category_idx on public.marketplace_category_fields(category_id, sort_order);

alter table public.marketplace_categories enable row level security;
alter table public.marketplace_category_fields enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_categories'
      and policyname = 'marketplace_categories_public_read_active'
  ) then
    create policy marketplace_categories_public_read_active
      on public.marketplace_categories
      for select
      to anon, authenticated
      using (is_active = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_category_fields'
      and policyname = 'marketplace_category_fields_public_read_active_parent'
  ) then
    create policy marketplace_category_fields_public_read_active_parent
      on public.marketplace_category_fields
      for select
      to anon, authenticated
      using (
        exists (
          select 1
          from public.marketplace_categories categories
          where categories.id = marketplace_category_fields.category_id
            and categories.is_active = true
        )
      );
  end if;
end
$$;

grant select on public.marketplace_categories to anon, authenticated;
grant select on public.marketplace_category_fields to anon, authenticated;
grant all on public.marketplace_categories to service_role;
grant all on public.marketplace_category_fields to service_role;

insert into public.marketplace_categories (
  slug,
  name_ar,
  name_en,
  description_ar,
  description_en,
  icon_name,
  offer_type,
  experience_key,
  sort_order,
  is_active
)
values
  ('vehicles', 'المركبات', 'Vehicles', 'سيارات ودراجات وقطع وخدمات المركبات', 'Cars, bikes, parts, and vehicle services', 'cars', null, 'vehicles', 10, true),
  ('real-estate', 'العقار', 'Real estate', 'بيع وإيجار العقارات والمخازن والاستراحات', 'Property sale, rent, warehouses, and chalets', 'realestate', null, 'real_estate', 20, true),
  ('electronics', 'الإلكترونيات', 'Electronics', 'أجهزة وإلكترونيات وهواتف ولابتوبات', 'Devices, electronics, phones, and laptops', 'electronics', null, 'electronics', 30, true),
  ('home-living', 'المنزل والمعيشة', 'Home & living', 'أثاث وأجهزة منزلية واحتياجات المعيشة', 'Furniture, appliances, and everyday home needs', 'furniture', null, 'general', 40, true),
  ('equipment', 'المعدات', 'Equipment', 'معدات وأدوات للبيع أو الإيجار', 'Equipment and tools for sale or rent', 'services', null, 'general', 50, true),
  ('livestock', 'الحلال والمواشي', 'Livestock', 'مواشي وحلال واحتياجاتها', 'Livestock and related items', 'services', null, 'livestock', 60, true),
  ('services', 'الخدمات', 'Services', 'خدمات مهنية ومنزلية وتقنية', 'Professional, home, and tech services', 'services', null, 'services', 70, true),
  ('requests', 'الطلبات', 'Requests', 'طلبات شراء واستئجار وخدمات', 'Requests to buy, rent, and hire services', 'jobs', null, 'jobs', 80, true),
  ('general', 'عام', 'General', 'فئات عامة متنوعة', 'General purpose categories', 'jobs', null, 'general', 90, true)
on conflict (slug) do update
set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  description_ar = excluded.description_ar,
  description_en = excluded.description_en,
  icon_name = excluded.icon_name,
  offer_type = excluded.offer_type,
  experience_key = excluded.experience_key,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.marketplace_categories (
  parent_id,
  slug,
  name_ar,
  name_en,
  icon_name,
  offer_type,
  experience_key,
  sort_order,
  is_active
)
select roots.id, data.slug, data.name_ar, data.name_en, data.icon_name, data.offer_type, data.experience_key, data.sort_order, true
from (
  values
    ('vehicles', 'carSale', 'سيارات للبيع', 'Cars for sale', 'cars', 'sell', 'vehicles', 10),
    ('vehicles', 'carPartsAndServices', 'قطع وخدمات السيارات', 'Car parts & services', 'cars', 'sell', 'vehicles', 20),
    ('vehicles', 'truckAndHeavy', 'شاحنات ومعدات ثقيلة', 'Trucks & heavy equipment', 'cars', 'sell', 'vehicles', 30),
    ('vehicles', 'bikeSale', 'دراجات', 'Bikes', 'cars', 'sell', 'vehicles', 40),
    ('vehicles', 'carRent', 'سيارات للإيجار', 'Car rental', 'cars', 'rent', 'vehicles', 50),
    ('real-estate', 'propertySale', 'عقارات للبيع', 'Property for sale', 'realestate', 'sell', 'real_estate', 10),
    ('real-estate', 'propertyRent', 'عقارات للإيجار', 'Property for rent', 'realestate', 'rent', 'real_estate', 20),
    ('real-estate', 'chaletRent', 'شاليهات واستراحات', 'Chalets & resorts', 'realestate', 'rent', 'real_estate', 30),
    ('real-estate', 'warehouseRent', 'مستودعات ومخازن', 'Warehouses & storage', 'realestate', 'rent', 'real_estate', 40),
    ('electronics', 'deviceSale', 'أجهزة إلكترونية', 'Electronic devices', 'electronics', 'sell', 'electronics', 10),
    ('electronics', 'mobileSale', 'جوالات', 'Mobile phones', 'electronics', 'sell', 'electronics', 20),
    ('electronics', 'laptopSale', 'أجهزة لابتوب', 'Laptops', 'electronics', 'sell', 'electronics', 30),
    ('electronics', 'electronicPartsSale', 'قطع إلكترونية', 'Electronic parts', 'electronics', 'sell', 'electronics', 40),
    ('electronics', 'cameraGearRent', 'معدات تصوير للإيجار', 'Camera gear rental', 'electronics', 'rent', 'electronics', 50),
    ('home-living', 'furnitureSale', 'أثاث', 'Furniture', 'furniture', 'sell', 'general', 10),
    ('home-living', 'homeAppliancesSale', 'أجهزة منزلية', 'Home appliances', 'furniture', 'sell', 'general', 20),
    ('home-living', 'clothingSale', 'ملابس', 'Clothing', 'furniture', 'sell', 'general', 30),
    ('home-living', 'kidsSuppliesSale', 'مستلزمات أطفال', 'Kids supplies', 'furniture', 'sell', 'general', 40),
    ('home-living', 'generalGoods', 'سلع عامة', 'General goods', 'furniture', 'sell', 'general', 50),
    ('equipment', 'toolsEquipmentSale', 'أدوات ومعدات للبيع', 'Tools & equipment for sale', 'services', 'sell', 'general', 10),
    ('equipment', 'eventEquipmentRent', 'معدات مناسبات للإيجار', 'Event equipment rental', 'services', 'rent', 'general', 20),
    ('equipment', 'constructionToolsRent', 'معدات بناء للإيجار', 'Construction tools rental', 'services', 'rent', 'general', 30),
    ('livestock', 'livestockSale', 'مواشي وحلال', 'Livestock', 'services', 'sell', 'livestock', 10),
    ('services', 'serviceOffer', 'خدمات عامة', 'General services', 'services', 'service', 'services', 10),
    ('services', 'cleaningService', 'خدمات تنظيف', 'Cleaning services', 'services', 'service', 'services', 20),
    ('services', 'homeMaintenanceService', 'صيانة منزلية', 'Home maintenance', 'services', 'service', 'services', 30),
    ('services', 'electricalPlumbingService', 'كهرباء وسباكة', 'Electrical & plumbing', 'services', 'service', 'services', 40),
    ('services', 'movingService', 'نقل وعفش', 'Moving services', 'services', 'service', 'services', 50),
    ('services', 'designTechService', 'تصميم وتقنية', 'Design & tech', 'services', 'service', 'services', 60),
    ('services', 'photoVideoService', 'تصوير وفيديو', 'Photo & video', 'services', 'service', 'services', 70),
    ('services', 'deliveryService', 'توصيل وشحن', 'Delivery services', 'services', 'service', 'services', 80),
    ('services', 'womenServices', 'خدمات نسائية', 'Women services', 'services', 'service', 'services', 90),
    ('services', 'studentServices', 'خدمات طلابية', 'Student services', 'services', 'service', 'services', 100),
    ('services', 'serviceOther', 'خدمات أخرى', 'Other services', 'services', 'service', 'services', 110),
    ('requests', 'requestGoods', 'طلب سلع', 'Request goods', 'jobs', 'request', 'jobs', 10),
    ('requests', 'requestPurchase', 'طلب شراء', 'Purchase request', 'jobs', 'request', 'jobs', 20),
    ('requests', 'requestRent', 'طلب استئجار', 'Rent request', 'jobs', 'request', 'jobs', 30),
    ('requests', 'requestHomeService', 'طلب خدمة منزلية', 'Home service request', 'jobs', 'request', 'services', 40),
    ('requests', 'requestTechService', 'طلب خدمة تقنية', 'Tech service request', 'jobs', 'request', 'services', 50),
    ('requests', 'requestUrgentMaintenance', 'طلب صيانة عاجلة', 'Urgent maintenance request', 'jobs', 'request', 'services', 60),
    ('requests', 'requestOther', 'طلبات أخرى', 'Other requests', 'jobs', 'request', 'jobs', 70),
    ('general', 'saleOther', 'أخرى للبيع', 'Other items for sale', 'jobs', 'sell', 'general', 10),
    ('general', 'rentOther', 'أخرى للإيجار', 'Other rentals', 'jobs', 'rent', 'general', 20)
) as data(parent_slug, slug, name_ar, name_en, icon_name, offer_type, experience_key, sort_order)
join public.marketplace_categories as roots
  on roots.slug = data.parent_slug
on conflict (slug) do update
set
  parent_id = excluded.parent_id,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  icon_name = excluded.icon_name,
  offer_type = excluded.offer_type,
  experience_key = excluded.experience_key,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.marketplace_category_fields (
  category_id,
  field_key,
  field_type,
  label_ar,
  label_en,
  placeholder_ar,
  placeholder_en,
  helper_text_ar,
  helper_text_en,
  is_required,
  filterable,
  detail_visible,
  options_json,
  sort_order
)
select
  categories.id,
  data.field_key,
  data.field_type,
  data.label_ar,
  data.label_en,
  data.placeholder_ar,
  data.placeholder_en,
  data.helper_text_ar,
  data.helper_text_en,
  data.is_required,
  data.filterable,
  data.detail_visible,
  data.options_json::jsonb,
  data.sort_order
from (
  values
    ('carSale', 'make', 'select', 'الماركة', 'Make', null, null, 'اختيار الماركة يساعد في التسعير والمقارنة', 'Make improves pricing guidance and comparisons', true, true, true, '[]', 10),
    ('carSale', 'model', 'select', 'الموديل', 'Model', null, null, 'اختر موديل السيارة بدقة', 'Choose the exact model', true, true, true, '[]', 20),
    ('carSale', 'year', 'number', 'سنة الصنع', 'Year', 'مثال: 2022', 'Example: 2022', null, null, true, true, true, '[]', 30),
    ('carSale', 'mileage', 'number', 'الممشى', 'Mileage', 'مثال: 85000', 'Example: 85000', null, null, true, true, true, '[]', 40),
    ('carSale', 'condition', 'select', 'الحالة', 'Condition', null, null, null, null, true, true, true, '[{"value":"new","labelAr":"جديد","labelEn":"New"},{"value":"likeNew","labelAr":"شبه جديد","labelEn":"Like new"},{"value":"used","labelAr":"مستعمل","labelEn":"Used"}]', 50),
    ('carSale', 'fuelType', 'select', 'نوع الوقود', 'Fuel type', null, null, null, null, false, true, true, '[{"value":"gasoline","labelAr":"بنزين","labelEn":"Gasoline"},{"value":"diesel","labelAr":"ديزل","labelEn":"Diesel"},{"value":"hybrid","labelAr":"هايبرد","labelEn":"Hybrid"},{"value":"electric","labelAr":"كهرباء","labelEn":"Electric"}]', 60),
    ('propertySale', 'propertyType', 'select', 'نوع العقار', 'Property type', null, null, null, null, true, true, true, '[{"value":"apartment","labelAr":"شقة","labelEn":"Apartment"},{"value":"villa","labelAr":"فيلا","labelEn":"Villa"},{"value":"land","labelAr":"أرض","labelEn":"Land"},{"value":"building","labelAr":"عمارة","labelEn":"Building"}]', 10),
    ('propertySale', 'district', 'text', 'الحي', 'District', 'اسم الحي', 'District name', null, null, true, true, true, '[]', 20),
    ('propertySale', 'areaSqm', 'number', 'المساحة (م²)', 'Area (sqm)', 'مثال: 250', 'Example: 250', null, null, true, true, true, '[]', 30),
    ('propertySale', 'bedrooms', 'number', 'غرف النوم', 'Bedrooms', null, null, null, null, false, true, true, '[]', 40),
    ('propertySale', 'bathrooms', 'number', 'دورات المياه', 'Bathrooms', null, null, null, null, false, true, true, '[]', 50),
    ('propertyRent', 'propertyType', 'select', 'نوع العقار', 'Property type', null, null, null, null, true, true, true, '[{"value":"apartment","labelAr":"شقة","labelEn":"Apartment"},{"value":"villa","labelAr":"فيلا","labelEn":"Villa"},{"value":"floor","labelAr":"دور","labelEn":"Floor"},{"value":"office","labelAr":"مكتب","labelEn":"Office"}]', 10),
    ('propertyRent', 'district', 'text', 'الحي', 'District', 'اسم الحي', 'District name', null, null, true, true, true, '[]', 20),
    ('propertyRent', 'areaSqm', 'number', 'المساحة (م²)', 'Area (sqm)', null, null, null, null, true, true, true, '[]', 30),
    ('propertyRent', 'furnished', 'boolean', 'مفروش', 'Furnished', null, null, null, null, false, true, true, '[]', 40),
    ('mobileSale', 'brand', 'text', 'العلامة التجارية', 'Brand', 'مثال: Apple', 'Example: Apple', null, null, true, true, true, '[]', 10),
    ('mobileSale', 'model', 'text', 'الموديل', 'Model', 'مثال: iPhone 15 Pro', 'Example: iPhone 15 Pro', null, null, true, true, true, '[]', 20),
    ('mobileSale', 'storage', 'text', 'السعة', 'Storage', 'مثال: 256GB', 'Example: 256GB', null, null, false, true, true, '[]', 30),
    ('mobileSale', 'batteryHealth', 'number', 'صحة البطارية', 'Battery health', 'مثال: 91', 'Example: 91', null, null, false, true, true, '[]', 40),
    ('mobileSale', 'warranty', 'boolean', 'يوجد ضمان', 'Has warranty', null, null, null, null, false, true, true, '[]', 50),
    ('livestockSale', 'animalType', 'text', 'نوع الحلال', 'Animal type', 'مثال: غنم', 'Example: Sheep', null, null, true, true, true, '[]', 10),
    ('livestockSale', 'breed', 'text', 'السلالة', 'Breed', null, null, null, null, false, true, true, '[]', 20),
    ('livestockSale', 'age', 'text', 'العمر', 'Age', null, null, null, null, false, true, true, '[]', 30),
    ('livestockSale', 'quantity', 'number', 'العدد', 'Quantity', null, null, null, null, false, true, true, '[]', 40),
    ('serviceOffer', 'serviceArea', 'text', 'منطقة الخدمة', 'Service area', 'مثال: شمال الرياض', 'Example: North Riyadh', null, null, true, true, true, '[]', 10),
    ('serviceOffer', 'responseTime', 'text', 'سرعة الرد', 'Response time', 'مثال: خلال 10 دقائق', 'Example: within 10 minutes', null, null, false, false, true, '[]', 20),
    ('serviceOffer', 'expectedCompletion', 'text', 'مدة الإنجاز المتوقعة', 'Expected completion time', null, null, null, null, false, false, true, '[]', 30),
    ('requestGoods', 'desiredItem', 'text', 'المطلوب', 'Requested item', 'مثال: سوني 5 مستعمل', 'Example: Used PS5', null, null, true, true, true, '[]', 10),
    ('requestGoods', 'targetBudget', 'number', 'الميزانية', 'Budget', 'مثال: 1200', 'Example: 1200', null, null, false, true, true, '[]', 20),
    ('requestHomeService', 'urgency', 'select', 'درجة الاستعجال', 'Urgency', null, null, null, null, false, true, true, '[{"value":"today","labelAr":"اليوم","labelEn":"Today"},{"value":"thisWeek","labelAr":"هذا الأسبوع","labelEn":"This week"},{"value":"flexible","labelAr":"مرن","labelEn":"Flexible"}]', 10)
) as data(category_slug, field_key, field_type, label_ar, label_en, placeholder_ar, placeholder_en, helper_text_ar, helper_text_en, is_required, filterable, detail_visible, options_json, sort_order)
join public.marketplace_categories as categories
  on categories.slug = data.category_slug
on conflict (category_id, field_key) do update
set
  field_type = excluded.field_type,
  label_ar = excluded.label_ar,
  label_en = excluded.label_en,
  placeholder_ar = excluded.placeholder_ar,
  placeholder_en = excluded.placeholder_en,
  helper_text_ar = excluded.helper_text_ar,
  helper_text_en = excluded.helper_text_en,
  is_required = excluded.is_required,
  filterable = excluded.filterable,
  detail_visible = excluded.detail_visible,
  options_json = excluded.options_json,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.listings
  add column if not exists offer_type text,
  add column if not exists category_slug text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_offer_type_check'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_offer_type_check
      check (offer_type is null or offer_type in ('sell', 'rent', 'service', 'request'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listings_category_slug_fkey'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_category_slug_fkey
      foreign key (category_slug)
      references public.marketplace_categories(slug)
      on update cascade
      on delete set null;
  end if;
end
$$;

create index if not exists listings_offer_type_idx on public.listings(offer_type);
create index if not exists listings_category_slug_idx on public.listings(category_slug);

update public.listings as listings
set offer_type = categories.offer_type
from public.marketplace_categories as categories
where listings.category_slug = categories.slug
  and listings.offer_type is null;