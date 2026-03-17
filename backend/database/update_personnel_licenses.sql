-- Add driver's license columns to personnel table
-- Run this in Supabase SQL Editor

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS drivers_license_number VARCHAR(50);
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS drivers_license_expiry DATE;

-- Update personnel with driver's license info and supervisor from employee register
-- Matching on full_name (the name used in the system)

-- Allan Stuurman
UPDATE personnel SET drivers_license_number = '40340003BS5B', drivers_license_expiry = '2028-12-01', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Allan%Stuurman%';

-- Adri Ludick
UPDATE personnel SET drivers_license_number = '40260012J753', drivers_license_expiry = '2029-07-01', supervisor = 'Philip Schutte'
WHERE full_name ILIKE '%Adri%Ludick%';

-- Adriaan Bouwer
UPDATE personnel SET drivers_license_number = '2061000BSN40', drivers_license_expiry = '2030-04-09', supervisor = 'Louis Peacock'
WHERE full_name ILIKE '%Adriaan%Bouwer%';

-- Marshall Rasimphi
UPDATE personnel SET drivers_license_number = '893900007T2S', drivers_license_expiry = '2029-07-20', supervisor = 'Riaan de Beer'
WHERE full_name ILIKE '%Marshall%Rasimphi%' OR full_name ILIKE '%Ailwel%Rasimphi%';

-- Alex Outram
UPDATE personnel SET drivers_license_number = '40670004P452', drivers_license_expiry = '2028-07-03', supervisor = 'Micheal Pretorius'
WHERE full_name ILIKE '%Alex%Outram%';

-- Andre Erasmus
UPDATE personnel SET drivers_license_number = '3037000047WC', drivers_license_expiry = '2028-11-01', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Andr%Erasmus%';

-- Andrew Robb
UPDATE personnel SET drivers_license_number = '40330002B1MM', drivers_license_expiry = '2026-05-24', supervisor = 'Louis Peacock'
WHERE full_name ILIKE '%Andrew%Robb%';

-- Annah Modutwane
UPDATE personnel SET drivers_license_number = '40500004R0PX', drivers_license_expiry = '2027-04-04', supervisor = 'Londolani Managa'
WHERE full_name ILIKE '%Annah%Modutwane%';

-- Annemie Willer
UPDATE personnel SET supervisor = 'Philip Schutte'
WHERE full_name ILIKE '%Annemie%Willer%';

-- Antonio Ehrke
UPDATE personnel SET drivers_license_number = '40280000DFVD', supervisor = 'Roger Henwood'
WHERE full_name ILIKE '%Antonio%Ehrke%' OR full_name ILIKE '%Anthony%Ehrke%';

-- Armindo Muchacho
UPDATE personnel SET drivers_license_number = '10338822', drivers_license_expiry = '2028-01-12', supervisor = 'Riaan du Plooy'
WHERE full_name ILIKE '%Armindo%Muchacho%';

-- Arnold van Zyl
UPDATE personnel SET drivers_license_number = '40500004RC61C', drivers_license_expiry = '2027-01-11', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Arnold%van Zyl%';

-- Aubrey Tshabalala
UPDATE personnel SET drivers_license_number = '4030003GP80', drivers_license_expiry = '2026-11-30', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%Aubrey%Tshabalala%';

-- Bernard Lopi Molangoane
UPDATE personnel SET drivers_license_number = '403100016381', drivers_license_expiry = '2026-02-25', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%Bernard%Molangoane%' OR full_name ILIKE '%Lopi%Molangoane%';

-- Chicco Tivane
UPDATE personnel SET drivers_license_number = '40810000792C', drivers_license_expiry = '2027-05-05', supervisor = 'Londolani Managa'
WHERE full_name ILIKE '%Chicco%Tivane%';

-- Chris Mostert
UPDATE personnel SET drivers_license_number = '20440004FTVD', drivers_license_expiry = '2027-05-05', supervisor = 'Eddie Pieterse Snr'
WHERE full_name ILIKE '%Chris%Mostert%';

-- Christene Smal
UPDATE personnel SET drivers_license_number = '40180004VV57', drivers_license_expiry = '2029-10-08', supervisor = 'Megan Salzwedel'
WHERE full_name ILIKE '%Christene%Smal%';

-- CJ Woller
UPDATE personnel SET drivers_license_number = '893800008ZGT', drivers_license_expiry = '2029-10-21', supervisor = 'Michael Pretorius'
WHERE full_name ILIKE '%CJ%Woller%';

-- Colleen Pyper
UPDATE personnel SET drivers_license_number = '41800002MWX', drivers_license_expiry = '2024-07-24', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Colleen%Pyper%';

-- Daniel Meintjies
UPDATE personnel SET drivers_license_number = '40270000507H', drivers_license_expiry = '2028-07-27', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Daniel%Meintjies%' OR full_name ILIKE '%Greef%Meintjies%';

-- Daniel Molapo
UPDATE personnel SET drivers_license_number = '42080000SSS8', drivers_license_expiry = '2030-03-14', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%Daniel%Molapo%';

-- Dave Viljoen
UPDATE personnel SET drivers_license_number = '499400002V3C', drivers_license_expiry = '2029-09-09', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Dave%Viljoen%' OR full_name ILIKE '%David%Viljoen%';

-- David Lipague
UPDATE personnel SET drivers_license_number = '110100365128N', drivers_license_expiry = '2027-05-18', supervisor = 'Riaan du Plooy'
WHERE full_name ILIKE '%David%Lipague%' OR full_name ILIKE '%David%Lipangue%';

-- Deon Gaarkeuken
UPDATE personnel SET drivers_license_number = '40670004MGTB', drivers_license_expiry = '2026-09-26', supervisor = 'Andrew Robb'
WHERE full_name ILIKE '%Deon%Gaarkeuken%';

-- Desmond Ngomane
UPDATE personnel SET drivers_license_number = '40310001632X', drivers_license_expiry = '2026-12-02', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%Desmond%Ngomane%' OR full_name ILIKE '%Dezman%Ngomane%';

-- Dian Leff
UPDATE personnel SET drivers_license_number = '502300000GCP', drivers_license_expiry = '2026-08-31', supervisor = 'Rohan Willer'
WHERE full_name ILIKE '%Dian%Leff%';

-- Douglas Prout-Jones
UPDATE personnel SET drivers_license_number = '893900002TTW', drivers_license_expiry = '2027-11-21', supervisor = 'Riaan de Beer'
WHERE full_name ILIKE '%Douglas%Prout%Jones%';

-- Eben Prinsloo
UPDATE personnel SET drivers_license_number = '41110004V40T', drivers_license_expiry = '2026-05-31', supervisor = 'Edward Pieterse Jnr'
WHERE full_name ILIKE '%Eben%Prinsloo%';

-- Edward Pieterse Jnr (Eddie)
UPDATE personnel SET drivers_license_number = '40370001DJ1JG', drivers_license_expiry = '2028-02-03', supervisor = 'Annemie Willer'
WHERE full_name ILIKE '%Edward%Pieterse%' AND full_name NOT ILIKE '%Snr%' AND (full_name ILIKE '%Jnr%' OR full_name ILIKE '%IV%' OR full_name ILIKE '%Eddie%Pieterse%');

-- Edward Pieterse Snr
UPDATE personnel SET drivers_license_number = '402300018G2K', drivers_license_expiry = '2028-09-26', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Edward%Pieterse%Snr%' OR full_name ILIKE '%Eddie%Pieterse%Snr%';

-- Edwin Gibbons
UPDATE personnel SET drivers_license_number = '40390000B97P', drivers_license_expiry = '2026-04-08', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Edwin%Gibbons%';

-- Ethel Mienie
UPDATE personnel SET drivers_license_number = '40500004STGG', drivers_license_expiry = '2028-08-17', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Ethel%Mienie%';

-- Eugene Scheepers
UPDATE personnel SET drivers_license_number = '499400003XM0', drivers_license_expiry = '2030-10-13', supervisor = 'Francois Pretorius'
WHERE full_name ILIKE '%Eugene%Scheepers%';

-- Evert Viljoen
UPDATE personnel SET drivers_license_number = '408700003VLV', drivers_license_expiry = '2029-07-03', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Evert%Viljoen%';

-- Francois Pretorius (Francios)
UPDATE personnel SET drivers_license_number = '41110004XCHJ', drivers_license_expiry = '2028-07-16', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Francois%Pretorius%' OR full_name ILIKE '%Francios%Pretorius%';

-- Francois van Eeden
UPDATE personnel SET drivers_license_number = '802300018C92', drivers_license_expiry = '2028-05-26', supervisor = 'Andrew Robb'
WHERE full_name ILIKE '%Francois%van Eeden%';

-- Francois Pienaar
UPDATE personnel SET drivers_license_number = '205700004PZ5', drivers_license_expiry = '2028-05-08', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Francois%Pienaar%';

-- Freddy-Ben Gariseb
UPDATE personnel SET supervisor = 'Rohan Willer'
WHERE full_name ILIKE '%Freddy%Gariseb%';

-- Gabriel Nuunyango
UPDATE personnel SET drivers_license_number = '500300027DZ7', drivers_license_expiry = '2030-07-29', supervisor = 'Rohan Willer'
WHERE full_name ILIKE '%Gabriel%Nuunyango%';

-- Godfrey Boikhutso
UPDATE personnel SET drivers_license_number = '40670004R3HK', drivers_license_expiry = '2029-07-05', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Godfrey%Boikhutso%';

-- Gordon Hoy (Freddy)
UPDATE personnel SET drivers_license_number = '418000003C49', drivers_license_expiry = '2026-08-26', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Gordon%Hoy%' OR full_name ILIKE '%Freddy%Hoy%';

-- Gustav Lourens
UPDATE personnel SET drivers_license_number = '40550004RRMB', drivers_license_expiry = '2027-04-25', supervisor = 'Eddie Pieterse Snr'
WHERE full_name ILIKE '%Gustav%Lourens%';

-- Hannest Koegelenberg
UPDATE personnel SET drivers_license_number = '403700019VXL', drivers_license_expiry = '2028-10-05', supervisor = 'Eddie Pieterse Snr'
WHERE full_name ILIKE '%Hannest%Koegelenberg%';

-- Hein Coetzer
UPDATE personnel SET drivers_license_number = '403100016M1S', drivers_license_expiry = '2028-08-24', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Hein%Coetzer%';

-- Heinrich Kusel
UPDATE personnel SET drivers_license_number = '40110003PCD3', drivers_license_expiry = '2030-01-08', supervisor = 'Roger Henwood'
WHERE full_name ILIKE '%Heinrich%Kusel%';

-- Henry Mherekumombe
UPDATE personnel SET drivers_license_number = '40242HY880005', drivers_license_expiry = '2028-11-09', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Henry%Mherekumombe%';

-- Isac Zacarias
UPDATE personnel SET drivers_license_number = '110502311354B', drivers_license_expiry = '2027-10-06', supervisor = 'Riaan du Plooy'
WHERE full_name ILIKE '%Isac%Zacarias%';

-- Jaco Venter
UPDATE personnel SET drivers_license_number = '418000003H21', drivers_license_expiry = '2026-12-22', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Jaco%Venter%';

-- Jaco Willer
UPDATE personnel SET drivers_license_number = '4046001S4T23', drivers_license_expiry = '2026-10-20', supervisor = 'Philip Schutte'
WHERE full_name ILIKE '%Jaco%Willer%';

-- Jaco de Beer
UPDATE personnel SET drivers_license_number = '40480002L86D', drivers_license_expiry = '2026-10-26', supervisor = 'Eben Prinsloo'
WHERE full_name ILIKE '%Jaco%de Beer%';

-- James Tshabalala
UPDATE personnel SET drivers_license_number = '20800003X7G', drivers_license_expiry = '2025-11-26', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%James%Tshabalala%';

-- Jan Booysens
UPDATE personnel SET drivers_license_number = '8938000026TO', drivers_license_expiry = '2027-07-09', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Jan%Booysens%';

-- Johan Louw (Jannie)
UPDATE personnel SET drivers_license_number = '40500004T788', drivers_license_expiry = '2029-02-05', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Johan%Louw%' OR full_name ILIKE '%Jannie%Louw%';

-- JJ de Beer
UPDATE personnel SET drivers_license_number = '8938000089W4', drivers_license_expiry = '2027-06-25', supervisor = 'Andrew Robb'
WHERE full_name ILIKE '%JJ%de Beer%' OR full_name ILIKE '%Jean Jacques%de Beer%';

-- Johan Bekker
UPDATE personnel SET drivers_license_number = '30750003CV1X', drivers_license_expiry = '2028-05-24', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Johan%Bekker%';

-- Johan Rossouw
UPDATE personnel SET drivers_license_number = '40260002HT16', drivers_license_expiry = '2028-03-28', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Johan%Rossouw%';

-- Johan Stols
UPDATE personnel SET drivers_license_number = '40800000600N', drivers_license_expiry = '2028-05-04', supervisor = 'Philip Schutte'
WHERE full_name ILIKE '%Johan%Stols%';

-- Johandre Oosthuizen
UPDATE personnel SET drivers_license_number = '6015001FVBZ', drivers_license_expiry = '2029-08-20'
WHERE full_name ILIKE '%Johandre%Oosthuizen%' OR full_name ILIKE '%Johandr%Oosthuizen%';

-- Joseph Kies
UPDATE personnel SET drivers_license_number = '40130002DS2V', drivers_license_expiry = '2027-11-30', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Joseph%Kies%' OR full_name ILIKE '%Joe%Kies%';

-- JP Jordaan
UPDATE personnel SET drivers_license_number = '40260002J78W', drivers_license_expiry = '2029-08-17', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%JP%Jordaan%' OR full_name ILIKE '%Jean-Pierre%Jordaan%';

-- Kevin Henwood
UPDATE personnel SET drivers_license_number = '41800000424L', drivers_license_expiry = '2029-12-19', supervisor = 'Roger Henwood'
WHERE full_name ILIKE '%Kevin%Henwood%';

-- Khotso Mosala
UPDATE personnel SET drivers_license_number = '40260002HPDC', drivers_license_expiry = '2027-10-18', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Khotso%Mosala%';

-- Leon Coetzee
UPDATE personnel SET drivers_license_number = '401900019R98', drivers_license_expiry = '2029-09-12', supervisor = 'Londolani Managa'
WHERE full_name ILIKE '%Leon%Coetzee%';

-- Lesego Khuthwane
UPDATE personnel SET drivers_license_number = '89380000D2YB', drivers_license_expiry = '2029-11-22', supervisor = 'Andrew Robb'
WHERE full_name ILIKE '%Lesego%Khuthwane%';

-- Lorraine Mokgethi (Lolo)
UPDATE personnel SET drivers_license_number = '40500004P6TZ', drivers_license_expiry = '2026-01-31', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Lorraine%Mokgethi%' OR full_name ILIKE '%Lolo%Mokgethi%';

-- Londolani Managa
UPDATE personnel SET drivers_license_number = '30270002B12T', drivers_license_expiry = '2029-04-03', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Londolani%Managa%';

-- Lubby Lubis (Labby Jeffrey)
UPDATE personnel SET drivers_license_number = '40340003BZLW', drivers_license_expiry = '2029-04-09', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Lubby%Lubis%' OR full_name ILIKE '%Labby%Lubis%';

-- Lucas Luus
UPDATE personnel SET drivers_license_number = '117200007B9L', drivers_license_expiry = '2029-10-06', supervisor = 'Andrew Robb'
WHERE full_name ILIKE '%Lucas%Luus%';

-- Mande Coetzee
UPDATE personnel SET drivers_license_number = '40230001768Y', drivers_license_expiry = '2026-05-28', supervisor = 'Shivon Alberts'
WHERE full_name ILIKE '%Mand%Coetzee%';

-- Marcel Schoeman
UPDATE personnel SET drivers_license_number = '40340003BPD2', drivers_license_expiry = '2028-10-29', supervisor = 'Annemie Willer'
WHERE full_name ILIKE '%Marcel%Schoeman%';

-- Mariette du Rand
UPDATE personnel SET drivers_license_number = '40090008PBDT', drivers_license_expiry = '2030-01-27', supervisor = 'Megan Salzwedel'
WHERE full_name ILIKE '%Mariette%du Rand%';

-- Martiens van Aarde
UPDATE personnel SET drivers_license_number = '40770000Z1B', drivers_license_expiry = '2027-08-28', supervisor = 'Tsietsi Monnanyane'
WHERE full_name ILIKE '%Martiens%van Aarde%';

-- Megan Salzwedel
UPDATE personnel SET drivers_license_number = '499400002CLV', drivers_license_expiry = '2029-05-16', supervisor = 'Edward Pieterse Jnr'
WHERE full_name ILIKE '%Megan%Salzwedel%';

-- Mervyn Gibbons
UPDATE personnel SET drivers_license_number = '40390000BBG1', drivers_license_expiry = '2028-09-06', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Mervyn%Gibbons%';

-- Micheal Pretorius
UPDATE personnel SET drivers_license_number = '40110003K0FM', drivers_license_expiry = '2025-07-30', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Micheal%Pretorius%' OR full_name ILIKE '%Michael%Pretorius%';

-- Micheal Masemola (Mike)
UPDATE personnel SET drivers_license_number = '4208000059SB', drivers_license_expiry = '2029-05-26', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%Micheal%Masemola%' OR full_name ILIKE '%Mike%Masemola%';

-- Betty Monyepao
UPDATE personnel SET drivers_license_number = '42060019BL', drivers_license_expiry = '2026-10-31', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%Betty%Monyepao%' OR full_name ILIKE '%Mmatapa%Monyepao%';

-- Morne Alberts
UPDATE personnel SET drivers_license_number = '205700005480', drivers_license_expiry = '2029-05-24', supervisor = 'Andrew Robb'
WHERE full_name ILIKE '%Morne%Alberts%' OR full_name ILIKE '%M%rne%Alberts%';

-- Nadhira Bux
UPDATE personnel SET drivers_license_number = '0180004VN96', drivers_license_expiry = '2029-09-07', supervisor = 'Louis Peacock'
WHERE full_name ILIKE '%Nadhira%Bux%';

-- Nico du Plessis
UPDATE personnel SET drivers_license_number = '408000006DPK', drivers_license_expiry = '2028-04-13', supervisor = 'Roger Henwood'
WHERE full_name ILIKE '%Nico%du Plessis%';

-- Muhamad Hanif
UPDATE personnel SET drivers_license_number = '10600226', drivers_license_expiry = '2027-08-02', supervisor = 'Riaan du Plooy'
WHERE full_name ILIKE '%Muhamad%Hanif%';

-- Lloyd Ngobeni
UPDATE personnel SET drivers_license_number = '40010007H92W', drivers_license_expiry = '2025-12-14', supervisor = 'Riaan de Beer'
WHERE full_name ILIKE '%Lloyd%Ngobeni%' OR full_name ILIKE '%Nkateko%Ngobeni%';

-- Nomvula Mkhize
UPDATE personnel SET drivers_license_number = '40620005J6BT', drivers_license_expiry = '2027-09-18', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Nomvula%Mkhize%';

-- Landus Walters (Norman)
UPDATE personnel SET drivers_license_number = '40500004SC2V', drivers_license_expiry = '2028-09-05', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Landus%Walters%' OR full_name ILIKE '%Norman%Walters%';

-- Passwell Mashoeu
UPDATE personnel SET drivers_license_number = '4208000053ZX', drivers_license_expiry = '2028-11-27', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%Passwell%Mashoeu%' OR full_name ILIKE '%Passwell%Mashoeou%';

-- Patrick Nel
UPDATE personnel SET drivers_license_number = '418000003N02', drivers_license_expiry = '2027-07-04', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Patrick%Nel%';

-- Peet Peacock
UPDATE personnel SET drivers_license_number = '400500004WSX', drivers_license_expiry = '2028-03-10', supervisor = 'Annemie Willer'
WHERE full_name ILIKE '%Peet%Peacock%';

-- Percy Hall
UPDATE personnel SET drivers_license_number = '4081000077LT', drivers_license_expiry = '2027-03-14', supervisor = 'Londolani Managa'
WHERE full_name ILIKE '%Percy%Hall%';

-- Permission Malele
UPDATE personnel SET drivers_license_expiry = '2028-06-30', supervisor = 'Annah Modutwane'
WHERE full_name ILIKE '%Permission%Malele%';

-- Peter Mahlangu
UPDATE personnel SET drivers_license_number = '0004201385', drivers_license_expiry = '2026-12-02', supervisor = 'Riaan du Plooy'
WHERE full_name ILIKE '%Peter%Mahlangu%';

-- Philip Schutte
UPDATE personnel SET supervisor = NULL
WHERE full_name ILIKE '%Philip%Schutte%';

-- Placido Maculuve
UPDATE personnel SET drivers_license_number = '100339585S', drivers_license_expiry = '2027-07-24', supervisor = 'Riaan du Plooy'
WHERE full_name ILIKE '%Placido%Maculuve%';

-- Reinier Kalp
UPDATE personnel SET drivers_license_number = '499400003MYS', drivers_license_expiry = '2030-04-24', supervisor = 'Andrew Robb'
WHERE full_name ILIKE '%Reinier%Kalp%';

-- Riaan du Plooy
UPDATE personnel SET drivers_license_number = '40680001HC3W', drivers_license_expiry = '2029-04-15', supervisor = 'Jaco Willer'
WHERE full_name ILIKE '%Riaan%du Plooy%';

-- Riaan de Beer
UPDATE personnel SET drivers_license_number = '40500004RJ56', drivers_license_expiry = '2027-05-05', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Riaan%de Beer%';

-- Roger Henwood
UPDATE personnel SET drivers_license_number = '40500004PK85', drivers_license_expiry = '2026-06-30', supervisor = 'Philip Schutte'
WHERE full_name ILIKE '%Roger%Henwood%';

-- Rakcal Balaram
UPDATE personnel SET supervisor = 'Francois Pienaar'
WHERE full_name ILIKE '%Rakcal%Balaram%';

-- Rohan Willer
UPDATE personnel SET drivers_license_number = '40670004NJTM', drivers_license_expiry = '2027-11-15', supervisor = 'Jaco Willer'
WHERE full_name ILIKE '%Rohan%Willer%';

-- Rynhardt Meyer
UPDATE personnel SET drivers_license_number = '893900007VWC', drivers_license_expiry = '2029-07-28', supervisor = 'Riaan de Beer'
WHERE full_name ILIKE '%Rynhardt%Meyer%';

-- Rynhardt Smit
UPDATE personnel SET drivers_license_number = '40500004RO8D', drivers_license_expiry = '2026-09-18', supervisor = 'Roger Henwood'
WHERE full_name ILIKE '%Rynhardt%Smit%';

-- Sergent Thlou (Sergant Tlou)
UPDATE personnel SET drivers_license_number = '404100018701', drivers_license_expiry = '2026-11-07', supervisor = 'Eben Prinsloo'
WHERE full_name ILIKE '%Serg%nt%Tl%u%' OR full_name ILIKE '%Serg%nt%Thl%u%';

-- Shaun Janse van Rensburg
UPDATE personnel SET drivers_license_number = '40280005XYRV', drivers_license_expiry = '2027-03-31', supervisor = 'Johan Stols'
WHERE full_name ILIKE '%Shaun%Janse van Rensburg%';

-- Shivon Alberts
UPDATE personnel SET drivers_license_number = '205700004YTP', drivers_license_expiry = '2028-06-12', supervisor = 'Megan Salzwedel'
WHERE full_name ILIKE '%Shivon%Alberts%';

-- Simon Mosima
UPDATE personnel SET drivers_license_number = '40770000F7G6', drivers_license_expiry = '2028-05-09', supervisor = 'Tsietsi Monnanyane'
WHERE full_name ILIKE '%Simon%Mosima%';

-- Simon Difutso
UPDATE personnel SET drivers_license_number = '408700003BS1', drivers_license_expiry = '2026-07-04', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Simon%Difutso%';

-- Sipho Zwane
UPDATE personnel SET drivers_license_number = '404300014X6T', drivers_license_expiry = '2026-06-02', supervisor = 'Francois Pienaar'
WHERE full_name ILIKE '%Sipho%Zwane%';

-- Sipho Mathibela
UPDATE personnel SET drivers_license_number = '403400039SMK', drivers_license_expiry = '2027-03-04', supervisor = 'Londolani Managa'
WHERE full_name ILIKE '%Sipho%Mathibela%';

-- Teresa Venter
UPDATE personnel SET drivers_license_number = '418000003P7V', drivers_license_expiry = '2028-07-28', supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Teresa%Venter%';

-- Thapelo Mohlala
UPDATE personnel SET drivers_license_number = '42080000SZ28', drivers_license_expiry = '2028-08-14', supervisor = 'Allan Stuurman'
WHERE full_name ILIKE '%Thapelo%Mohlala%';

-- Thomas Mdhlala
UPDATE personnel SET supervisor = 'Michael Pretorius'
WHERE full_name ILIKE '%Thomas%Mdhlala%';

-- Thulani Tembe
UPDATE personnel SET drivers_license_number = '205700005G5M', drivers_license_expiry = '2030-02-17', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Thulani%Tembe%';

-- Tonny Simelani
UPDATE personnel SET drivers_license_expiry = '2026-10-28', supervisor = 'Eddie Pieterse Snr'
WHERE full_name ILIKE '%Tonny%Simelani%';

-- Tsietsi Monnanyane
UPDATE personnel SET drivers_license_number = '40420004LJ45', drivers_license_expiry = '2028-09-18', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Tsietsi%Monnanyane%' OR full_name ILIKE '%Tsietsi%Monnanyne%';

-- Vernon Calvert
UPDATE personnel SET drivers_license_number = '4062000SHSRY', drivers_license_expiry = '2027-04-25', supervisor = 'Riaan de Beer'
WHERE full_name ILIKE '%Vernon%Calvert%';

-- Wihan Willer
UPDATE personnel SET drivers_license_number = '893900007VV8', drivers_license_expiry = '2029-07-28', supervisor = 'Francois Pretorius'
WHERE full_name ILIKE '%Wihan%Willer%';

-- Mike Shongwe (Mbozra)
UPDATE personnel SET supervisor = 'Adri Ludick'
WHERE full_name ILIKE '%Mike%Shongwe%' OR full_name ILIKE '%Mbongeni%Shongwe%';

-- Meshack Nxumalo
UPDATE personnel SET supervisor = 'Francois Pienaar'
WHERE full_name ILIKE '%Meshack%Nxumalo%';

-- Louis Peacock
UPDATE personnel SET supervisor = 'Annemie Willer'
WHERE full_name ILIKE '%Louis%Peacock%';

-- Bianka de Beer
UPDATE personnel SET supervisor = 'Megan Salzwedel'
WHERE full_name ILIKE '%Bianka%de Beer%';

-- Johandre Oosthuizen (supervisor not listed, skip)

-- Eddie Pieterse Jnr specific fix (ensure correct match)
UPDATE personnel SET drivers_license_number = '40370001DJ1JG', drivers_license_expiry = '2028-02-03', supervisor = 'Annemie Willer'
WHERE full_name ILIKE '%Eddie%Pieterse%' AND full_name NOT ILIKE '%Snr%';

-- Eddie Pieterse Snr specific fix
UPDATE personnel SET drivers_license_number = '402300018G2K', drivers_license_expiry = '2028-09-26', supervisor = 'Peet Peacock'
WHERE full_name ILIKE '%Eddie Pieterse Snr%' OR (full_name ILIKE '%Edward%Pieterse%' AND employee_id = 'WC271');
