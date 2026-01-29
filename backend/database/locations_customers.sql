-- WearCheck Internal Locations and Customer Sites
-- This script sets up:
-- 1. Internal locations (WearCheck branches)
-- 2. Customer sites (where technicians take equipment)

-- ============================================
-- STEP 1: Create Customers Table (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_number VARCHAR(50) UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    region VARCHAR(50) NOT NULL DEFAULT 'Local', -- 'Local' or 'Overseas'
    country VARCHAR(100),
    province_state VARCHAR(100),
    city VARCHAR(100),
    billing_city VARCHAR(100),
    shipping_city VARCHAR(100),
    email VARCHAR(255),
    vat_number VARCHAR(50),
    vat_treatment VARCHAR(50),
    currency_code VARCHAR(10) DEFAULT 'ZAR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STEP 2: Add customer_id to equipment_movements (if not exists)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'equipment_movements' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE equipment_movements ADD COLUMN customer_id INTEGER REFERENCES customers(id);
    END IF;
END $$;

-- ============================================
-- STEP 3: Update Internal Locations (Safe approach)
-- ============================================

-- First, update existing equipment to point to a valid location
-- Then add real branch locations using INSERT ... ON CONFLICT

-- Mark sample locations as inactive (instead of deleting)
UPDATE locations SET is_active = FALSE WHERE name IN ('Main Store', 'Field Services', 'Calibration Lab', 'Workshop');

-- Insert WearCheck internal branch locations (or update if exists)
INSERT INTO locations (name, description, is_active) VALUES
    ('ARC Head Office - Longmeadow', 'WearCheck ARC Head Office, Longmeadow Business Estate, Johannesburg', TRUE),
    ('ARC Springs', 'WearCheck ARC Springs Branch', TRUE),
    ('WearCheck KZN', 'WearCheck KwaZulu-Natal Branch', TRUE)
ON CONFLICT (name) DO UPDATE SET 
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- ============================================
-- STEP 4: Insert Customers - South Africa (Local)
-- ============================================

INSERT INTO customers (customer_number, display_name, region, country, province_state, city, email, vat_number, vat_treatment, currency_code) VALUES
-- Gauteng
('CUS-00002', 'A Siwele General Services', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'giftmsimeki3@gmail.com', NULL, 'vat_not_registered', 'ZAR'),
('CUS-00008', 'Air Products South Africa (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'sandiso.mngadi@airproducts.co.za', '4020120673', 'vat_registered', 'ZAR'),
('CUS-00009', 'Air Rotory Services (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Retha@airrotoryservices.co.za', '4470274590', 'vat_registered', 'ZAR'),
('CUS-00011', 'Ana-Digi Systems (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'hanneleze@anadigi.co.za', '4160103661', 'vat_registered', 'ZAR'),
('CUS-00019', 'Astec Industries South Africa (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'fventer@astecindustries.com', '4570189573', 'vat_registered', 'ZAR'),
('CUS-00034', 'David Brown Santasalo SA (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Thato.Diale@dbsantasalo.com', NULL, 'vat_not_registered', 'ZAR'),
('CUS-00037', 'Diesel Innovations (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', NULL, '4330198146', 'vat_registered', 'ZAR'),
('CUS-00043', 'Elite Truck Hire', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'lesleyp@elitetruck.co.za', '4130141197', 'vat_registered', 'ZAR'),
('CUS-00050', 'Fixturlaser South Africa (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'gerrit@fixturlaser.co.za', '4320268784', 'vat_registered', 'ZAR'),
('CUS-00052', 'Fraser Alexander (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'KhumbulaniS@fraseralexander.co.za', '4860224031', 'vat_registered', 'ZAR'),
('CUS-00053', 'Frys Metals a division of LeadX (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'NkosinathiG@Frys.co.za', '4820314369', 'vat_registered', 'ZAR'),
('CUS-00056', 'Givaudan South Africa (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Nicole.davis@givaudan.com', '4890107479', 'vat_registered', 'ZAR'),
('CUS-00061', 'GZ Industries South Africa (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Katlego.Moloko@gzican.com', '4760282196', 'vat_registered', 'ZAR'),
('CUS-00062', 'Harmony Moab Khotsong Operations (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', NULL, '4250280130', 'vat_registered', 'ZAR'),
('CUS-00063', 'Heineken Beverages - Springs', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'cherese.bosch@heineken.com', '4180211080', 'vat_registered', 'ZAR'),
('CUS-00064', 'Heineken Beverages - Wadeville', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Kabelo.bokgwathile@heineken.com', '4180211080', 'vat_registered', 'ZAR'),
('CUS-00067', 'Idwala Industrial Holdings (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'asp@idwala.co.za', '4280211352', 'vat_registered', 'ZAR'),
('CUS-00070', 'Impala Platinum Refineries Limited', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Brand.venter@implats.co.za', '4680121797', 'vat_registered', 'ZAR'),
('CUS-00071', 'Industrial Water Cooling (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'edwin@iwc.co.za', '4210112092', 'vat_registered', 'ZAR'),
('CUS-00073', 'Ingrain SA (Pty) Ltd - Germiston Mill', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Thembekile.Salman@ingrainsa.com', '4670292392', 'vat_registered', 'ZAR'),
('CUS-00074', 'Ingrain SA (Pty) Ltd - Kliprivier Mill', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Tubi.Mokotong@ingrainsa.com', '4670292392', 'vat_registered', 'ZAR'),
('CUS-00075', 'Kalagadi Manganese (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'tebogo.maroeshe@kalagadi.co.za', '4230235865', 'vat_registered', 'ZAR'),
('CUS-00076', 'Karan Beef (Pty) Ltd - Balfour', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'benniek@karanbeef.com', '4100174228', 'vat_registered', 'ZAR'),
('CUS-00077', 'Karan Beef (Pty) Ltd - City Deep', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'Bhernard.Montgomery@karanbeef.com', '4100174228', 'vat_registered', 'ZAR'),
('CUS-00078', 'Kelvin Powerstation (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'tenders@kelvinpower.com', '4220193553', 'vat_registered', 'ZAR'),
('CUS-00093', 'Mondi South Africa (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'pieter.bekker@mondigroup.com', '4330102007', 'vat_registered', 'ZAR'),
('CUS-00094', 'Mpact Operations (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'KAmiappen@Mpact.co.za', '4590176527', 'vat_registered', 'ZAR'),
('CUS-00095', 'MpowerU Africa (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', 'charnel@mpoweru.co.za', '4920273176', 'vat_registered', 'ZAR'),
('1AF201', 'African Oxygen Limited t/a Afrox', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', NULL, '4120110541', 'vat_registered', 'ZAR'),
('2AI106', 'Air Liquide Large Industries (Pty) Ltd', 'Local', 'South Africa', 'Gauteng', 'Johannesburg', NULL, '4480103177', 'vat_registered', 'ZAR'),

-- North West
('CUS-00010', 'Almec Manufacturing (Pty) Ltd', 'Local', 'South Africa', 'North West', 'Klerksdorp', 'heino@almecmanufacturing.co.za', '4300112838', 'vat_registered', 'ZAR'),
('CUS-00012', 'Valterra Platinum Limited - Precious Metals Refineries', 'Local', 'South Africa', 'North West', 'Rustenburg', 'freddie.mocke@valterraplatinum.com', '4310113883', 'vat_registered', 'ZAR'),
('CUS-00057', 'Glencore Marafe Venture - PSV Magareng Mine', 'Local', 'South Africa', 'North West', 'Rustenburg', 'reinett.mohlala@glencore.co.za', '4010216903', 'vat_registered', 'ZAR'),
('CUS-00112', 'Northam Platinum Limited', 'Local', 'South Africa', 'North West', 'Brits', 'Advice.Letshela@norplats.co.za', '4530124520', 'vat_registered', 'ZAR'),
('CUS-00128', 'Valterra Platinum Limited - Mortimer Smelter', 'Local', 'South Africa', 'North West', 'Rustenburg', 'karabo.sathekge@valterraplatinum.com', '4310113883', 'vat_registered', 'ZAR'),
('CUS-00162', 'Tharisa Minerals - Genesis', 'Local', 'South Africa', 'North West', 'Rustenburg', 'dsithole@tharisa.com', '4860238387', 'vat_registered', 'ZAR'),
('CUS-00163', 'Tharisa Minerals - Voyager', 'Local', 'South Africa', 'North West', 'Rustenburg', 'ptshabalala@tharisa.com', '4860238387', 'vat_registered', 'ZAR'),
('CUS-00164', 'Tharisa Minerals - Vulcan Plant', 'Local', 'South Africa', 'North West', 'Rustenburg', 'TMaruma@tharisa.com', '4860238387', 'vat_registered', 'ZAR'),

-- KwaZulu-Natal
('CUS-00021', 'Blendcor (Pty) Ltd', 'Local', 'South Africa', 'KwaZulu-Natal', 'Bluff', 'Bobby.Pillay@blendcor.co.za', '4730133743', 'vat_registered', 'ZAR'),
('CUS-00038', 'Drivetek Engineeing (Pty) Ltd', 'Local', 'South Africa', 'KwaZulu-Natal', 'Westmead', 'kevinw@technidrives.co.za', '4470284540', 'vat_registered', 'ZAR'),
('CUS-00044', 'Engie - Peakers Operations (Pty) Ltd', 'Local', 'South Africa', 'KwaZulu-Natal', 'Durban', 'natasha.james@engie.com', '4580269977', 'vat_registered', 'ZAR'),
('CUS-00066', 'Hytec South Africa (RF) (Pty) Ltd - Richards Bay', 'Local', 'South Africa', 'KwaZulu-Natal', 'Richards Bay', 'marius.froneman@boschrexroth.co.za', '4340213919', 'vat_registered', 'ZAR'),
('CUS-00068', 'Illovo Sugar SA (Pty) Ltd - Eston', 'Local', 'South Africa', 'KwaZulu-Natal', 'Eston', 'SibMkhwanazi@illovo.co.za', '4790254926', 'vat_registered', 'ZAR'),
('CUS-00069', 'Illovo Sugar SA (Pty) Ltd - Sezela', 'Local', 'South Africa', 'KwaZulu-Natal', 'Durban', 'MaGovender@ILLOVO.co.za', '4790254926', 'vat_registered', 'ZAR'),
('CUS-00152', 'South African Sugar Association', 'Local', 'South Africa', 'KwaZulu-Natal', 'Durban North', 'Sindi.Gumede@sasa.org.za', '4410108247', 'vat_registered', 'ZAR'),
('CUS-00168', 'Tongaat Hulett Limited t/a Tongaat Hulett Sugar', 'Local', 'South Africa', 'KwaZulu-Natal', 'Durban', 'Trevor.Naidoo@tongaat.com', '4570102634', 'vat_registered', 'ZAR'),
('CUS-00169', 'Tronox KZN Sands (Pty) Ltd', 'Local', 'South Africa', 'KwaZulu-Natal', 'Empangeni', 'nicole.seumangal@tronox.com', '4500118130', 'vat_registered', 'ZAR'),
('1AL024', 'South32 - Hillside Aluminium (Pty) Ltd', 'Local', 'South Africa', 'KwaZulu-Natal', 'Richards Bay', 'johan.j.oberholzer@south32.net', '4460199757', 'vat_registered', 'ZAR'),

-- Mpumalanga
('CUS-00022', 'Blue Mining Services (Pty) Ltd', 'Local', 'South Africa', 'Mpumalanga', 'Middelburg', NULL, NULL, 'vat_not_registered', 'ZAR'),
('CUS-00028', 'Cofco International Standerton Oil Mills (Pty) Ltd', 'Local', 'South Africa', 'Mpumalanga', 'Standerton', 'BasilHolloway@cofcointernational.com', '4780262830', 'vat_registered', 'ZAR'),
('CUS-00029', 'Columbus Stainless (Pty) Ltd', 'Local', 'South Africa', 'Mpumalanga', 'Middelburg', 'wilson.robin@columbus.co.za', '4640196368', 'vat_registered', 'ZAR'),
('CUS-00082', 'Kwena Mining Projects (Pty) Ltd', 'Local', 'South Africa', 'Mpumalanga', 'Witbank', 'chrisoost@kwenamining.co.za', '4260238870', 'vat_registered', 'ZAR'),
('CUS-00087', 'McCain Foods South Africa (Pty) Ltd - Delmas', 'Local', 'South Africa', 'Mpumalanga', 'Delmas', 'sabelo.mehlomakhulu@mccain.co.za', '4420188494', 'vat_registered', 'ZAR'),
('CUS-00096', 'Msobo Coal (Pty) Ltd', 'Local', 'South Africa', 'Mpumalanga', 'Breyten', 'rodney.white@northerncoal.co.za', '4030216297', 'vat_registered', 'ZAR'),
('CUS-00143', 'Sappi Southern Africa Ltd - Ngodwana Mill', 'Local', 'South Africa', 'Mpumalanga', 'Mbombela', 'Hubert.DuPreez@sappi.com', '4750105456', 'vat_registered', 'ZAR'),
('CUS-00146', 'Seriti Power (Pty) Ltd - Khutala Colliery', 'Local', 'South Africa', 'Mpumalanga', 'Ogies', 'santosh.ca.kumar@seritiza.com', '4850204555', 'vat_registered', 'ZAR'),
('CUS-00172', 'Two Rivers Platinum (Pty) Ltd', 'Local', 'South Africa', 'Mpumalanga', 'Lydenburg', 'elize.bobraine@trp.co.za', '4180194443', 'vat_registered', 'ZAR'),

-- Limpopo
('CUS-00041', 'Dwarsrivier Chrome mine (Pty) Ltd', 'Local', 'South Africa', 'Limpopo', 'Lydenburg', 'jacoh@dwarsrivier.co.za', '4210272078', 'vat_registered', 'ZAR'),
('CUS-00058', 'Glencore Merafe Join Venture - PSV Helena', 'Local', 'South Africa', 'Limpopo', 'Steelpoort', 'Cheryl-Ann.Bezuidenhout@glencore.co.za', '4010216903', 'vat_registered', 'ZAR'),
('CUS-00086', 'Eskom - Matimba Powerstation', 'Local', 'South Africa', 'Limpopo', 'Lephalale', 'molaudr@eskom.co.za', '4740101508', 'vat_registered', 'ZAR'),
('CUS-00092', 'Modikwa Platinum Mine', 'Local', 'South Africa', 'Limpopo', 'Driekop', 'moses.mathopo@angloamerican.com', '4310113883', 'vat_registered', 'ZAR'),
('CUS-00111', 'Northam Booysendal - Lydenburg', 'Local', 'South Africa', 'Mpumalanga', 'Lydenburg', 'Kgalemo.Lentswe@norplats.co.za', '4070202751', 'vat_registered', 'ZAR'),
('CUS-00120', 'PMC Palabora Mining Company', 'Local', 'South Africa', 'Limpopo', 'Phalaborwa', 'Ezrom.Khosa@palabora.co.za', NULL, 'vat_not_registered', 'ZAR'),
('CUS-00170', 'THM - Twickenham Platinum mine - Hackney Shaft', 'Local', 'South Africa', 'Limpopo', 'Driekop', 'leonard.mafahla@angloamerican.com', '4310113883', 'vat_registered', 'ZAR'),
('CUS-00344', 'Ferroglobe South Africa (Pty) Ltd', 'Local', 'South Africa', 'Limpopo', 'Polokwane', 'cornell.mamabolo@ferroglobe.com', '4310178506', 'vat_registered', 'ZAR'),

-- Western Cape
('CUS-00004', 'Abengoa Solar Power South Africa (Pty) Ltd - Xina O & M Company', 'Local', 'South Africa', 'Western Cape', 'Cape Town', 'jodine.waterboer@abengoa.com', '4250279033', 'vat_registered', 'ZAR'),
('CUS-00025', 'City of Cape Town', 'Local', 'South Africa', 'Western Cape', 'Bellville', 'Siyabonga.Manyamalala@capetown.gov.za', '4500193497', 'vat_registered', 'ZAR'),
('CUS-00065', 'Howden Africa Compressor and Turbines (HACT)', 'Local', 'South Africa', 'Western Cape', 'Stikland', 'Caroline.Booysen@howden.co.za', '4610118533', 'vat_registered', 'ZAR'),
('CUS-00072', 'Ingrain SA (Pty) Ltd - Bellville Mill', 'Local', 'South Africa', 'Western Cape', 'Cape Town', 'Cheryl.Pearce@ingrainsa.com', '4670292392', 'vat_registered', 'ZAR'),
('CUS-00089', 'Mediclinic (Pty) Ltd - Stellenbosch', 'Local', 'South Africa', 'Western Cape', 'Stellenbosch', 'audrey.govindasamy@mediclinic.co.za', '4760118184', 'vat_registered', 'ZAR'),
('CUS-00137', 'SA Metal Group (Pty) Ltd', 'Local', 'South Africa', 'Western Cape', 'Cape Town', 'robert.young@sametal.co.za', '4190108110', 'vat_registered', 'ZAR'),
('CUS-00158', 'Table Mountain Cableway (Pty) Ltd', 'Local', 'South Africa', 'Western Cape', 'Cape Town', 'emile@tablemountain.net', '4140101058', 'vat_registered', 'ZAR'),

-- Northern Cape
('CUS-00018', 'Assmang Iron Ore - Khumani Mine', 'Local', 'South Africa', 'Northern Cape', 'Kuruman', 'Keitumetse.Komet@assmang.co.za', '4310113883', 'vat_registered', 'ZAR'),
('CUS-00020', 'Atlantica South Africa Operations (Pty) Ltd', 'Local', 'South Africa', 'Northern Cape', 'Upington', 'gillnorishia.lategaan@abengoa.com', '4470302003', 'vat_registered', 'ZAR'),
('CUS-00035', 'De Aar Solar Power (RF) (Pty) Ltd', 'Local', 'South Africa', 'Northern Cape', 'De Aar', 'sulana.dejager@globeleq.co.za', '4920261817', 'vat_registered', 'ZAR'),
('CUS-00045', 'Engie - Kathu Operations (Pty) Ltd', 'Local', 'South Africa', 'Northern Cape', 'Kathu', 'nomathamsanqa.mdlela@engie.com', '4420278790', 'vat_registered', 'ZAR'),
('CUS-00190', 'Anglo American Sishen Kumba Iron Ore', 'Local', 'South Africa', 'Northern Cape', 'Kathu', 'amogelang.gaosekwe@angloamerican.com', '4060193812', 'vat_registered', 'ZAR'),

-- Free State
('2SE106', 'AECI Mining Chemicals, a division of AECI Mining Ltd', 'Local', 'South Africa', 'Free State', 'Sasolburg', 'neels.vanvuuren@aeciworld.com', '4140211857', 'vat_registered', 'ZAR'),

-- Eastern Cape
('CUS-00361', 'BASF Catalysts South Africa (Pty) Ltd', 'Local', 'South Africa', 'Eastern Cape', 'Port Elizabeth', 'willem.feuth@basf-catalystsmetals.com', '4360310520', 'vat_registered', 'ZAR')

ON CONFLICT (customer_number) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    region = EXCLUDED.region,
    country = EXCLUDED.country,
    province_state = EXCLUDED.province_state,
    city = EXCLUDED.city,
    email = EXCLUDED.email,
    vat_number = EXCLUDED.vat_number,
    vat_treatment = EXCLUDED.vat_treatment;

-- ============================================
-- STEP 5: Insert Customers - Overseas (Africa & International)
-- ============================================

INSERT INTO customers (customer_number, display_name, region, country, province_state, city, email, vat_number, vat_treatment, currency_code) VALUES
-- Namibia
('CUS-00027', 'CNNC Rössing Uranium', 'Overseas', 'Namibia', 'Windhoek', 'Arandis', 'Kenneth.Strauss@Rossing.com.na', NULL, 'vat_not_registered', 'NAD'),
('CUS-00036', 'De Beers Marine Namibia (Pty) Ltd', 'Overseas', 'Namibia', 'Khomas Region', 'Windhoek', 'Jaco.vanHeerden@debmarine.com', '1877555-01-5', 'vat_registered', 'ZAR'),
('CUS-00181', 'WearCheck - Namibia', 'Overseas', 'Namibia', NULL, NULL, 'gerritf@wearcheck.co.na', NULL, 'overseas', 'ZAR'),
('CUS-00383', 'CGN Swakop Uranium', 'Overseas', 'Namibia', 'Erongo', 'Swakopmund', 'alfredo.fernando@cgnpc.com.cn', '42973870-15', 'overseas', 'NAD'),
('CUS-00404', 'Langer Heinrich Uranium (Pty) Ltd', 'Overseas', 'Namibia', NULL, 'Swakopmund', 'Simon.Ekandjo@lhupl.com', NULL, 'overseas', 'NAD'),

-- DRC (Democratic Republic of Congo)
('CUS-00039', 'DRS Innovative Mining Solutions', 'Overseas', 'Democratic Republic of Congo', 'Katanga', 'Lubumbashi', 'Marat.Tulegenov@ergafrica.com', 'A0905460W', 'overseas', 'USD'),
('CUS-00079', 'Kibali Gold Mine', 'Overseas', 'Democratic Republic of Congo', 'Kinshasa', 'Kinshasa', 'renet@wearcheck.co.za', NULL, 'overseas', 'USD'),
('CUS-00606', 'Kamoa Copper SA', 'Overseas', 'Democratic Republic of Congo', 'Lualaba', NULL, 'edwardDL@kamoacopper.com', NULL, 'overseas', 'USD'),

-- Zambia
('CUS-00343', 'Bigtree Beverages Limited', 'Overseas', 'Zambia', 'Lusaka', NULL, 'omer@bigtreebrands.com', NULL, 'overseas', 'ZAR'),
('CUS-00390', 'Mopani copper Mines - Zambia', 'Overseas', 'Zambia', NULL, NULL, 'Senthilkumar.Sivanath@mopani.com.zm', NULL, 'overseas', 'USD'),
('CUS-00559', 'FQM Trident Limited', 'Overseas', 'Zambia', NULL, NULL, 'shawn.Graham@fgml.com', NULL, 'overseas', 'USD'),
('CUS-00593', 'WearCheck Zambia', 'Overseas', 'Zambia', NULL, NULL, 'boniface@wearcheck.co.zm', NULL, 'overseas', 'ZMW'),
('CUS-00662', 'Sable Zinc Kabwe Limited', 'Overseas', 'Zambia', NULL, NULL, 'mwaba.mwachiyaba@sablezinc.co.zm', NULL, 'overseas', 'USD'),

-- Zimbabwe
('CUS-00180', 'WearCheck - Mozambique', 'Overseas', 'Zimbabwe', 'Harare', 'Harare', 'Riaandp@wearcheckRS.com', NULL, 'overseas', 'ZAR'),
('CUS-00448', 'Delta Beverages', 'Overseas', 'Zimbabwe', 'Harare', 'Harare', 'd.munotiyi@delta.co.zw', NULL, 'overseas', 'USD'),
('CUS-00554', 'Freda Rebecca Gold Mine - Bindura Zimbabwe', 'Overseas', 'Zimbabwe', NULL, NULL, 'mmhembere@fredarebecca.co.zw', NULL, 'overseas', 'USD'),
('CUS-00459', 'RZM Murowa (Pvt) Limited', 'Overseas', 'Zimbabwe', NULL, NULL, 'shesbyc@wearcheck.co.zw', NULL, 'overseas', 'USD'),

-- Mozambique
('CUS-00371', 'South32 - Mozal Aluminium', 'Overseas', 'Mozambique', 'Maputo', 'Caixa', 'riaan@wearcheckrs.com', NULL, 'overseas', 'ZAR'),

-- Madagascar
('CUS-00042', 'Dynatec - Madagascar SA', 'Overseas', 'Madagascar', 'Toamasina', 'Toamasina', 'Manitra.Razafindraibe@ambatovy.mg', NULL, 'overseas', 'USD'),
('CUS-00123', 'QIT Minerals - Madagascar', 'Overseas', 'Madagascar', 'Antananarivo', 'Fort Dauphin', 'Amelia.Louw@riotinto.com', NULL, 'overseas', 'USD'),

-- Ghana
('CUS-00211', 'Greenfields Offshore Services Ltd', 'Overseas', 'Ghana', 'Upper West', 'Ghana', 'lawrence-j@greenfieldsoffshore.com', 'CS125532012', 'overseas', 'USD'),
('CUS-00491', 'Sulzer Mansa Rotating Equipment Services (Ghana) Ltd', 'Overseas', 'Ghana', NULL, NULL, 'bruce.mclean@sulzer.com', NULL, 'overseas', 'GBP'),
('CUS-00533', 'Max Lambda', 'Overseas', 'Ghana', 'Greater Accra', 'Abelemkpe Accra', 'supplychain@max-lambda.com', NULL, 'overseas', 'USD'),
('CUS-00541', 'Tullow Ghana Limited', 'Overseas', 'Ghana', 'Western', 'Accra', 'roger.hevi@tullowoil.com', 'C0002551888', 'overseas', 'USD'),
('CUS-00618', 'Wearcheck Ghana Limited', 'Overseas', 'Ghana', NULL, 'Accra', 'marvinn@wearcheck.co.za', NULL, 'overseas', 'ZAR'),

-- Botswana
('CUS-00348', 'Diamond Trading Company Botswana', 'Overseas', 'Botswana', NULL, 'Gaborone', 'OHabana@dtcb.co.bw', NULL, 'overseas', 'USD'),
('CUS-00566', 'Pre-Uam Holdings (Pty) Ltd', 'Overseas', 'Botswana', 'North-East', 'Francistown', 'dvdem@ymail.com', NULL, 'overseas', 'USD'),
('CUS-00601', 'Debswana - Orapa, Letlhakane and Damtshaa Mines', 'Overseas', 'Botswana', NULL, NULL, 'OMatumbe@debswana.bw', NULL, 'overseas', 'USD'),
('CUS-00602', 'Botswana Power Corporation', 'Overseas', 'Botswana', NULL, NULL, 'Mohuhutsot@bpc.bw', NULL, 'overseas', 'USD'),

-- Angola
('CUS-00350', 'SBM Offshore Angola Ltd - FPSO Saxi', 'Overseas', 'Angola', 'Bermuda', 'Hamilton', 'Paulino.brito@sbmoffshore.com', '5402068909', 'overseas', 'USD'),
('CUS-00351', 'SBM Offshore Angola Ltd - FPSO Ngoma', 'Overseas', 'Angola', 'Bermuda', 'Hamilton', 'paulino.brito@sbmoffshore.com', '5402068909', 'overseas', 'USD'),
('CUS-00670', 'SBM Offshore Anglo Ltd - FPSO Mondo', 'Overseas', 'Angola', 'Bermuda', 'Hamilton', 'Paulino.brito@sbmoffshore.com', '5402068909', 'overseas', 'USD'),
('CUS-00724', 'Equipment & Controls C. I., Ltd – Sucursal de Angola', 'Overseas', 'Angola', NULL, 'Luanda', 'theuns.oosthuizen@ec-africa.com', NULL, 'overseas', 'USD'),

-- Eswatini (Swaziland)
('CUS-00452', 'Lactalis Eswatini', 'Overseas', 'Eswatini', 'Manzini', 'Halfway House', 'Temalangeni.Dlamini@sz.lactalis.com', NULL, 'overseas', 'ZAR'),
('CUS-00578', 'Coca-cola Eswatini', 'Overseas', 'Eswatini', 'Manzini', 'Matsapha', 'sifsithole@coca-cola.com', NULL, 'overseas', 'USD'),

-- Mali
('CUS-00438', 'Resolute Mining - Mine de Syama Gold Mine', 'Overseas', 'Mali', 'Bamako', 'Quartier Hamdallaye', 'SPrawiro@somisy.com', NULL, 'overseas', 'USD'),
('CUS-00726', 'Saly Service Maili', 'Overseas', 'Mali', 'Bamako', NULL, 'cheick.d@salyservice.com', NULL, 'overseas', 'USD'),

-- Tanzania
('CUS-00543', 'Apex Mining Services Ltd', 'Overseas', 'Tanzania', NULL, NULL, 'Nelson.Mwingira@appex.co.tz', NULL, 'overseas', 'USD'),

-- Mauritius
('CUS-00699', 'Omnicane Thermal Energy Operations (La Baraque) Limited', 'Overseas', 'Mauritius', NULL, NULL, 'ddeenoo@omnicane.com', 'VAT20307006', 'overseas', 'USD'),

-- Malaysia
('1SS504', 'ABACO Offshore Limited', 'Overseas', 'Malaysia', 'Wilayah Persekutuan Kuala Lumpur', 'Kuala', 'gabriel.tungo@bumiarmada.com', NULL, 'overseas', 'USD'),

-- Algeria
('CUS-00589', 'Sarl Toucontrols', 'Overseas', 'Algeria', 'Alger', 'Algerie', 'malika.bozetine@toucontrols.com', NULL, 'overseas', 'USD')

ON CONFLICT (customer_number) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    region = EXCLUDED.region,
    country = EXCLUDED.country,
    province_state = EXCLUDED.province_state,
    city = EXCLUDED.city,
    email = EXCLUDED.email,
    vat_number = EXCLUDED.vat_number,
    vat_treatment = EXCLUDED.vat_treatment;

-- ============================================
-- STEP 6: Verify Import
-- ============================================

SELECT 'Internal Locations' as type, COUNT(*) as count FROM locations
UNION ALL
SELECT 'Local Customers (SA)' as type, COUNT(*) as count FROM customers WHERE region = 'Local'
UNION ALL
SELECT 'Overseas Customers' as type, COUNT(*) as count FROM customers WHERE region = 'Overseas';
