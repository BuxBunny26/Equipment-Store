/**
 * Upsert Personnel from Employee List
 *
 * Checks Supabase for each person below.
 * - If they exist (matched by email), their details are updated.
 * - If they don't exist, they are inserted.
 *
 * Usage (from backend/ or backend/database/ folder):
 *   set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *   set SUPABASE_SERVICE_KEY=your_service_role_key
 *   node database/upsert_personnel.js
 *
 * NOTE: SUPABASE_SERVICE_KEY (service_role key) is required — the anon key
 *       does not have permission to bypass Row Level Security for inserts.
 *       Get both values from: Supabase Dashboard → Settings → API
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\nMissing required environment variables.');
    console.error('  set SUPABASE_URL=https://YOUR_PROJECT.supabase.co');
    console.error('  set SUPABASE_SERVICE_KEY=your_service_role_key\n');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// PERSONNEL DATA  (extracted from Employee List spreadsheet)
// Columns: employee_id, full_name, first_name, last_name, email, job_title
// full_name = Preferred Name + Surname (used throughout the app).
// N/A employee codes are given a generated ID based on email prefix so they
// don't conflict — update them to real codes if you get them later.
// ─────────────────────────────────────────────────────────────────────────────
const PERSONNEL = [
  { employee_id: 'WC591',   full_name: 'Adriaan du Plooy',           first_name: 'Adriaan',       last_name: 'du Plooy',          email: 'adriaandp@wearcheckrs.com',       job_title: 'Mozambique - Country Manager' },
  { employee_id: 'WC383',   full_name: 'Adriaan Bouwer',             first_name: 'Adriaan',       last_name: 'Bouwer',            email: 'adriaanb@wearcheckrs.com',        job_title: 'Reliability Analyst Thermography' },
  { employee_id: 'WEC004',  full_name: 'Marshall Rasimphi',          first_name: 'Marshall',      last_name: 'Rasimphi',          email: 'marshall@wearcheckrs.com',        job_title: 'Reliability Technologist' },
  { employee_id: 'WEC105',  full_name: 'Alex Outram',                first_name: 'Alex',          last_name: 'Outram',            email: 'alex@wearcheckrs.com',            job_title: 'Reliability Technologist' },
  { employee_id: 'WC124',   full_name: 'Allan Stuurman',             first_name: 'Allan',         last_name: 'Stuurman',          email: 'allan@wearcheckrs.com',           job_title: 'Reliability Specialist' },
  { employee_id: 'WEC103',  full_name: 'Andrew Walker',              first_name: 'Andrew',        last_name: 'Walker',            email: 'andrew.walker@wearcheckrs.com',   job_title: 'Remote Centre Manager' },
  { employee_id: 'WEC139',  full_name: 'Adri Ludick',                first_name: 'Adri',          last_name: 'Ludick',            email: 'a.ludick@wearcheckrs.com',        job_title: 'NDT/Training Assistant Manager' },
  { employee_id: 'NA-annah',full_name: 'Annemie Modutswane',         first_name: 'Annemie',       last_name: 'Modutswane',        email: 'annah@wearcheckrs.com',           job_title: 'Administrator Steelpoort' },
  { employee_id: 'WC319',   full_name: 'Annemie Willer',             first_name: 'Annemie',       last_name: 'Willer',            email: 'annemio@wearcheckrs.com',         job_title: 'Divisional Manager' },
  { employee_id: 'WEC503',  full_name: 'Antonio Ehrke',              first_name: 'Antonio',       last_name: 'Ehrke',             email: 'antonio.ehrke@wearcheckrs.com',   job_title: 'Machine Inspector Level 2 RCA' },
  { employee_id: 'NA-armindo', full_name: 'Armindo Mucacho',         first_name: 'Armindo',       last_name: 'Mucacho',           email: 'armindo@wearcheckrs.com',         job_title: 'Site Supervisor' },
  { employee_id: 'WC526',   full_name: 'Arnold van Zyl',             first_name: 'Arnold',        last_name: 'van Zyl',           email: 'arnold@wearcheckrs.com',          job_title: 'Reliability Technologist' },
  { employee_id: 'WEC114',  full_name: 'Aubrey Tshabalala',          first_name: 'Aubrey',        last_name: 'Tshabalala',        email: 'aubrey@wearcheckrs.com',          job_title: 'Reliability Technologist' },
  { employee_id: 'WC269',   full_name: 'Bernard Molangoane',         first_name: 'Bernard',       last_name: 'Molangoane',        email: 'lopi@wearcheckrs.com',            job_title: 'Reliability Technologist' },
  { employee_id: 'WEC142',  full_name: 'Bianka de Beer',             first_name: 'Bianka',        last_name: 'de Beer',           email: 'bianka@wearcheckrs.com',          job_title: 'RS Administrator Temp' },
  { employee_id: 'WEC052',  full_name: 'Boithunelo Mokghamatha',     first_name: 'Boithunelo',    last_name: 'Mokghamatha',       email: 'boitumelo@wearcheckrs.com',       job_title: 'Reliability Technologist' },
  { employee_id: 'WEC001',  full_name: 'Chicco Tiwane',              first_name: 'Chicco',        last_name: 'Tiwane',            email: 'chicco@wearcheckrs.com',          job_title: 'Reliability Technologist' },
  { employee_id: 'WEC100',  full_name: 'Chris Mostert',              first_name: 'Chris',         last_name: 'Mostert',           email: 'chrism@wearcheckrs.com',          job_title: 'Reliability Specialist' },
  { employee_id: 'WC285',   full_name: 'Christiene Smal',            first_name: 'Christiene',    last_name: 'Smal',              email: 'christiene@wearcheckrs.com',      job_title: 'RS Administrator' },
  { employee_id: 'WEC120',  full_name: 'CJ Woller',                  first_name: 'CJ',            last_name: 'Woller',            email: 'cj@wearcheckrs.com',              job_title: 'Reliability Specialist' },
  { employee_id: 'NA-colleen', full_name: 'Collett Pyper',           first_name: 'Collett',       last_name: 'Pyper',             email: 'colleen.pyper@wearcheckrs.com',   job_title: 'Administration Assistant' },
  { employee_id: 'WC528',   full_name: 'Daniel Meintjies',           first_name: 'Daniel',        last_name: 'Meintjies',         email: 'groeftm@wearcheck.co.za',         job_title: 'Machine Inspector Level 2 Mech' },
  { employee_id: 'WEC127',  full_name: 'David Lipange',              first_name: 'David',         last_name: 'Lipange',           email: 'david@wearcheckrs.com',           job_title: 'Reliability Technologist' },
  { employee_id: 'WEC081',  full_name: 'Dave Viljoen',               first_name: 'Dave',          last_name: 'Viljoen',           email: 'davev@wearcheckrs.com',           job_title: 'Reliability Specialist' },
  { employee_id: 'WEC146',  full_name: 'Degy Lecordeur',             first_name: 'Degy',          last_name: 'Lecordeur',         email: 'degy@wearcheckrs.com',            job_title: 'Level 1 NDT Inspector' },
  { employee_id: 'WC358',   full_name: 'Deon Gaarkeeuken',           first_name: 'Deon',          last_name: 'Gaarkeeuken',       email: 'deon@wearcheckrs.com',            job_title: 'Mpumalanga Co-ordinator' },
  { employee_id: 'WCN008',  full_name: 'Dian Leff',                  first_name: 'Dian',          last_name: 'Leff',              email: 'dian@wearcheckrs.com',            job_title: 'Reliability Technologist' },
  { employee_id: 'WC119',   full_name: 'Douglas Prout-Jones',        first_name: 'Douglas',       last_name: 'Prout-Jones',       email: 'douglas@wearcheckrs.com',         job_title: 'Reliability Technologist' },
  { employee_id: 'WEC145',  full_name: 'Dyllon van Heerdon',         first_name: 'Dyllon',        last_name: 'van Heerdon',       email: 'dyllon@wearcheckrs.com',          job_title: 'Level 1 NDT Inspector' },
  { employee_id: 'WC122',   full_name: 'Eben Prinsloo',              first_name: 'Eben',          last_name: 'Prinsloo',          email: 'eben@wearcheckrs.com',            job_title: 'Angio Semantics Co-ordinator' },
  { employee_id: 'WEC271',  full_name: 'Edward Pieterse',            first_name: 'Edward Snr',    last_name: 'Pieterse',          email: 'epieterse@wearcheckrs.com',       job_title: 'Gauteng Co-ordinator' },
  { employee_id: 'WC274',   full_name: 'Eddie Pieterse',             first_name: 'Eddie Jnr',     last_name: 'Pieterse',          email: 'edwardfp@wearcheckrs.com',        job_title: 'Operations Manager' },
  { employee_id: 'WEC138',  full_name: 'Edwin Gibbons',              first_name: 'Edwin',         last_name: 'Gibbons',           email: 'edwin@wearcheckrs.com',           job_title: 'Instrumentation Technician' },
  { employee_id: 'WC488',   full_name: 'Ethel Mlenie',               first_name: 'Ethel',         last_name: 'Mlenie',            email: 'ethel.mlenie@wearcheckrs.com',    job_title: 'Administration Assistant' },
  { employee_id: 'WEC090',  full_name: 'Eugene Scheepers',           first_name: 'Eugene',        last_name: 'Scheepers',         email: 'eugene@wearcheckrs.com',          job_title: 'Precision Maintenance Technologist' },
  { employee_id: 'NA-evert',full_name: 'Evert Viljoen',              first_name: 'Evert',         last_name: 'Viljoen',           email: 'evert@wearcheck.co.za',           job_title: 'Machine Inspector Level 2 NDT' },
  { employee_id: 'WC289',   full_name: 'Francois Ferreira',          first_name: 'Francois',      last_name: 'Ferreira',          email: 'francove@wearcheckrs.com',        job_title: 'Reliability Technologist' },
  { employee_id: 'WCN004',  full_name: 'Heinrich Kusel',             first_name: 'Heinrich',      last_name: 'Kusel',             email: 'heinrich@wearcheckrs.com',        job_title: 'Rope Inspector' },
  { employee_id: 'WCN007',  full_name: 'Gabriel Shikongo Nuunyango', first_name: 'Gabriel Shikongo', last_name: 'Nuunyango',      email: 'gabriel@wearcheckrs.com',         job_title: 'Reliability Specialist' },
  { employee_id: 'WE510',   full_name: 'Godfrey Boikhutso',          first_name: 'Godfrey',       last_name: 'Boikhutso',         email: 'godfrey@wearcheck.co.za',         job_title: 'Machine Inspector Level 2 TC' },
  { employee_id: 'WEC093',  full_name: 'Freddy Hoy',                 first_name: 'Freddy',        last_name: 'Hoy',               email: 'freddieh@wearcheck.co.za',        job_title: 'Machine Inspector Level 1 Mech' },
  { employee_id: 'WC200',   full_name: 'Gustav Lourens',             first_name: 'Gustav',        last_name: 'Lourens',           email: 'gustav@wearcheckrs.com',          job_title: 'Reliability Technologist' },
  { employee_id: 'WEC047',  full_name: 'Hannest Koegelenberg',       first_name: 'Hannest',       last_name: 'Koegelenberg',      email: 'hannest@wearcheckrs.com',         job_title: 'Reliability Analyst' },
  { employee_id: 'WC129',   full_name: 'Hein Coetzer',               first_name: 'Hein',          last_name: 'Coetzer',           email: 'heinc@wearcheckrs.com',           job_title: 'Reliability Analyst' },
  { employee_id: 'WEC098',  full_name: 'Henry Mherekunombe',         first_name: 'Henry',         last_name: 'Mherekunombe',      email: 'henry@wearcheckrs.com',           job_title: 'Machine Inspector Level 2 NDT' },
  { employee_id: 'NA-rohan',full_name: 'Johan Rossouw',              first_name: 'Johan',         last_name: 'Rossouw',           email: 'rohan@wearcheckrs.com',           job_title: 'Reliability Specialist' },
  { employee_id: 'WEC493',  full_name: 'Isac Zacarias',              first_name: 'Isac',          last_name: 'Zacarias',          email: 'isac@wearcheckrs.com',            job_title: 'Reliability Technologist' },
  { employee_id: 'WC352',   full_name: 'Jaco Willer',                first_name: 'Jaco',          last_name: 'Willer',            email: 'jaco@wearcheckrs.com',            job_title: 'Foreign Ops BU Manager' },
  { employee_id: 'WC236',   full_name: 'James Tshabalala',           first_name: 'James',         last_name: 'Tshabalala',        email: 'james@wearcheckrs.com',           job_title: 'Reliability Technologist' },
  { employee_id: 'WEC496',  full_name: 'Jan Booysens',               first_name: 'Jan',           last_name: 'Booysens',          email: 'janb@wearcheck.co.za',            job_title: 'Machine Inspector Level 2 NDT' },
  { employee_id: 'WEC137',  full_name: 'JJ de Beer',                 first_name: 'JJ',            last_name: 'de Beer',           email: 'jj@wearcheckrs.com',              job_title: 'Reliability Technologist' },
  { employee_id: 'WEC141',  full_name: 'JP du Plessis',              first_name: 'JP',            last_name: 'du Plessis',        email: 'jean-pierre@wearcheckrs.com',     job_title: 'Machine Inspector Level 1 TC' },
  { employee_id: 'WC527',   full_name: 'JP Jordaan',                 first_name: 'JP',            last_name: 'Jordaan',           email: 'jeanj@wearcheck.co.za',           job_title: 'Machine Inspector Level 2 Mech' },
  { employee_id: 'WC645',   full_name: 'Johan Bekker',               first_name: 'Johan',         last_name: 'Bekker',            email: 'johanb@wearcheckrs.com',          job_title: 'Machine Inspector Level 1 TC' },
  { employee_id: 'WEC494',  full_name: 'Jannie Louw',                first_name: 'Jannie',        last_name: 'Louw',              email: 'janniel@wearcheck.co.za',         job_title: 'Machine Inspector Level 2 Mech' },
  { employee_id: 'WEC389',  full_name: 'Johnnie Gibbons',            first_name: 'Johnnie',       last_name: 'Gibbons',           email: 'johanne@wearcheckrs.com',         job_title: 'Reliability Technologist' },
  { employee_id: 'WC508',   full_name: 'Johan Stols',                first_name: 'Johan',         last_name: 'Stols',             email: 'johans@wearcheckrs.com',          job_title: 'Manager TC' },
  { employee_id: 'WEC491',  full_name: 'Johan Rossouw',              first_name: 'Johan',         last_name: 'Rossouw',           email: 'johanr@wearcheckrs.com',          job_title: 'Machine Inspector Level 2 TC' },
  { employee_id: 'WE531',   full_name: 'Joe Kies',                   first_name: 'Joe',           last_name: 'Kies',              email: 'josephk@wearcheck.co.za',         job_title: 'Machine Inspector Level 2 TC' },
  { employee_id: 'WEC111',  full_name: 'Francois Pienaar',           first_name: 'Francois',      last_name: 'Pienaar',           email: 'francioisp@wearcheckrs.com',      job_title: 'KZN Co-ordinator' },
  { employee_id: 'WEC135',  full_name: 'Permission Malele',          first_name: 'Permission',    last_name: 'Malele',            email: 'permission@wearcheckrs.com',      job_title: 'Reliability Technologist' },
  { employee_id: 'WEC482',  full_name: 'Khotso Mosala',              first_name: 'Khotso',        last_name: 'Mosala',            email: 'khotso@wearcheckrs.com',          job_title: 'Machine Inspector Level 2 TC' },
  { employee_id: 'WEC118',  full_name: 'Lubby Lubis',                first_name: 'Lubby',         last_name: 'Lubis',             email: 'lubby@wearcheckrs.com',           job_title: 'Reliability Specialist' },
  { employee_id: 'WEC144',  full_name: 'Leané Bodenstein',           first_name: 'Leané',         last_name: 'Bodenstein',        email: 'leane@wearcheckrs.com',           job_title: 'Diagnostician Trainee' },
  { employee_id: 'WEC458',  full_name: 'Leon Bezuidenhout',          first_name: 'Leon',          last_name: 'Bezuidenhout',      email: 'leon@wearcheckrs.com',            job_title: 'Reliability Specialist' },
  { employee_id: 'WC126',   full_name: 'Lesego Khuthwane',           first_name: 'Lesego',        last_name: 'Khuthwane',         email: 'lesego@wearcheckrs.com',          job_title: 'Intergration Specialist' },
  { employee_id: 'WC648',   full_name: 'Londolani Managa',           first_name: 'Londolani',     last_name: 'Managa',            email: 'londolam@wearcheckrs.com',        job_title: 'Reliability Specialist' },
  { employee_id: 'WEC495',  full_name: 'Lorraine Mokgethi',          first_name: 'Lorraine',      last_name: 'Mokgethi',          email: 'lorraine@wearcheckrs.com',        job_title: 'Machine Inspector Level 2 NDT' },
  { employee_id: 'WC277',   full_name: 'Louis Peacock',              first_name: 'Louis',         last_name: 'Peacock',           email: 'louis@wearcheckrs.com',           job_title: 'Technical & Training Manager' },
  { employee_id: 'WC068',   full_name: 'Lucas Luus',                 first_name: 'Lucas',         last_name: 'Luus',              email: 'lucas@wearcheckrs.com',           job_title: 'Reliability Technologist' },
  { employee_id: 'WEC016',  full_name: 'Mande Coetzee',              first_name: 'Mande',         last_name: 'Coetzee',           email: 'mande@wearcheckrs.com',           job_title: 'RS Administrator' },
  { employee_id: 'WEC102',  full_name: 'Marcel Schoeman',            first_name: 'Marcel',        last_name: 'Schoeman',          email: 'marcels@wearcheckrs.com',         job_title: 'Sales Manager' },
  { employee_id: 'WEC106',  full_name: 'Martiens van Aarde',         first_name: 'Martiens',      last_name: 'van Aarde',         email: 'martiens@wearcheckrs.com',        job_title: 'Reliability Technologist' },
  { employee_id: 'WEC034',  full_name: 'Megan Saltzwedel',           first_name: 'Megan',         last_name: 'Saltzwedel',        email: 'megan@wearcheckrs.com',           job_title: 'Administrative Manager' },
  { employee_id: 'WEC536',  full_name: 'Meghan Gibbons',             first_name: 'Meghan',        last_name: 'Gibbons',           email: 'meghanh@wearcheck.co.za',         job_title: 'Machine Inspector Level 2 TC' },
  { employee_id: 'WEC080',  full_name: 'Francios Pretorius',         first_name: 'Francios',      last_name: 'Pretorius',         email: 'francios@wearcheckrs.com',        job_title: 'Rosslyn Co-ordinator' },
  { employee_id: 'WC291',   full_name: 'Michael Masemola',           first_name: 'Michael',       last_name: 'Masemola',          email: 'michaelm@wearcheckrs.com',        job_title: 'Reliability Technologist' },
  { employee_id: 'WEC076',  full_name: 'Michael Pretorius',          first_name: 'Michael',       last_name: 'Pretorius',         email: 'michael@wearcheckrs.com',         job_title: 'Reliability Technologist' },
  { employee_id: 'WEC483',  full_name: 'Miko Shongwe',               first_name: 'Miko',          last_name: 'Shongwe',           email: 'mikos@wearcheckrs.com',           job_title: 'Machine Inspector Level 1 Mech' },
  { employee_id: 'WEC465',  full_name: 'Betty Monyepao',             first_name: 'Betty',         last_name: 'Monyepao',          email: 'betty@wearcheckrs.com',           job_title: 'Reliability Technologist' },
  { employee_id: 'WC283',   full_name: 'Simon Mosima',               first_name: 'Simon',         last_name: 'Mosima',            email: 'simon@wearcheckrs.com',           job_title: 'Reliability Technologist' },
  { employee_id: 'WC361',   full_name: 'Morne Alberts',              first_name: 'Morne',         last_name: 'Alberts',           email: 'mornea@wearcheckrs.com',          job_title: 'Precision Maintenance Technologist' },
  { employee_id: 'NA-muhamad', full_name: 'Muhamad Hanf',            first_name: 'Muhamad',       last_name: 'Hanf',              email: 'muhamad@wearcheckrs.com',         job_title: 'Reliability Technician' },
  { employee_id: 'WEC113',  full_name: 'Nadhira Bux',                first_name: 'Nadhira',       last_name: 'Bux',               email: 'nadhira@wearcheckrs.com',         job_title: 'Technology Integration Co-ordinator' },
  { employee_id: 'WC506',   full_name: 'Nico du Plessis',            first_name: 'Nico',          last_name: 'du Plessis',        email: 'nico.duplessis@wearcheckrs.com',  job_title: 'Machine Inspector Level 2 RCA' },
  { employee_id: 'WEC039',  full_name: 'Lloyd Ngobeni',              first_name: 'Lloyd',         last_name: 'Ngobeni',           email: 'lloyd@wearcheckrs.com',           job_title: 'Samancor Co-ordinator' },
  { employee_id: 'WC651',   full_name: 'Nomvula Mkhize',             first_name: 'Nomvula',       last_name: 'Mkhize',            email: 'nomvulam@wearcheckrs.com',        job_title: 'Reliability Specialist' },
  { employee_id: 'WC509',   full_name: 'Landus Walters',             first_name: 'Landus',        last_name: 'Walters',           email: 'landus@wearcheckrs.com',          job_title: 'Machine Inspector Level 1 TC' },
  { employee_id: 'WEC498',  full_name: 'Patrick Nel',                first_name: 'Patrick',       last_name: 'Nel',               email: 'patrick@wearcheckrs.com',         job_title: 'Machine Inspector Level 2 Mech' },
  { employee_id: 'WEC115',  full_name: 'Percy Hall',                 first_name: 'Percy',         last_name: 'Hall',              email: 'percy@wearcheckrs.com',           job_title: 'Precision Maintenance Technologist' },
  { employee_id: 'NA-peter',full_name: 'Peter Mahlangu',             first_name: 'Peter',         last_name: 'Mahlangu',          email: null,                              job_title: 'Senior Technician' },
  { employee_id: 'WC520',   full_name: 'Peet Peacock',               first_name: 'Peet',          last_name: 'Peacock',           email: 'peet@wearcheckrs.com',            job_title: 'Services Manager' },
  { employee_id: 'WC253',   full_name: 'Philip Schutte',             first_name: 'Philip',        last_name: 'Schutte',           email: 'philip@wearcheckrs.com',          job_title: 'General Manager' },
  { employee_id: 'NA-placido', full_name: 'Placido Maculuve',        first_name: 'Placido',       last_name: 'Maculuve',          email: 'placido@wearcheckrs.com',         job_title: 'Senior Technician' },
  { employee_id: 'WC348',   full_name: 'Passweil Mashoeou',          first_name: 'Passweil',      last_name: 'Mashoeou',          email: 'passweil@wearcheckrs.com',        job_title: 'Reliability Technologist' },
  { employee_id: 'WEC074',  full_name: 'Rakcal Balaram',             first_name: 'Rakcal',        last_name: 'Balaram',           email: 'rakcal@wearcheckrs.com',          job_title: 'Reliability Specialist' },
  { employee_id: 'WEC143',  full_name: 'Refuge Mpela',               first_name: 'Refuge',        last_name: 'Mpela',             email: 'refuge@wearcheckrs.com',          job_title: 'Rope Inspector Trainee' },
  { employee_id: 'WC382',   full_name: 'Reinier Kalp',               first_name: 'Reinier',       last_name: 'Kalp',              email: 'reinierk@wearcheckrs.com',        job_title: 'Reliability Analyst Vibration' },
  { employee_id: 'WC363',   full_name: 'Riaan de Beer',              first_name: 'Riaan',         last_name: 'de Beer',           email: 'riaandb@wearcheckrs.com',         job_title: 'RBMR Co-ordinator' },
  { employee_id: 'WEC504',  full_name: 'Roger Henwood',              first_name: 'Roger',         last_name: 'Henwood',           email: 'roger@wearcheckrs.com',           job_title: 'Manager RCA' },
  { employee_id: 'WC148',   full_name: 'Ryan Henwood',               first_name: 'Ryan',          last_name: 'Henwood',           email: 'ryan@wearcheckrs.com',            job_title: 'Machine Inspector Level 1 TC' },
  { employee_id: 'WEC539',  full_name: 'Rynhardt Meyer',             first_name: 'Rynhardt',      last_name: 'Meyer',             email: 'rynhardt@wearcheckrs.com',        job_title: 'Reliability Technologist' },
  { employee_id: 'WEC501',  full_name: 'Rynhardt Malaka',            first_name: 'Rynhardt',      last_name: 'Malaka',            email: 'rynhardt.smt@wearcheckrs.com',    job_title: 'Machine Inspector Level 2 RCA' },
  { employee_id: 'WEC147',  full_name: 'Samantha Carr',              first_name: 'Samantha',      last_name: 'Carr',              email: 'samantha@wearcheckrs.com',        job_title: 'RS Administrator' },
  { employee_id: 'WEC130',  full_name: 'Shivon Alberts',             first_name: 'Shivon',        last_name: 'Alberts',           email: 'shivon@wearcheckrs.com',          job_title: 'RS Administrator - Financial' },
  { employee_id: 'WEC245',  full_name: 'Simon Petrus Difutso',       first_name: 'Simon Petrus',  last_name: 'Difutso',           email: 'simondifutso@wearcheckrs.com',    job_title: 'Machine Inspector Level 2 NDT' },
  { employee_id: 'WC360',   full_name: 'Sipho Zwane',                first_name: 'Sipho',         last_name: 'Zwane',             email: 'siphoz@wearcheckrs.com',          job_title: 'Reliability Technologist' },
  { employee_id: 'WC350',   full_name: 'Sipho Mathibela',            first_name: 'Sipho',         last_name: 'Mathibela',         email: 'siphom@wearcheckrs.com',          job_title: 'Reliability Technologist' },
  { employee_id: 'WEC086',  full_name: 'Desmond Ngomano',            first_name: 'Desmond',       last_name: 'Ngomano',           email: 'desmond@wearcheckrs.com',         job_title: 'Reliability Technologist' },
  { employee_id: 'WC487',   full_name: 'Teresa Venter',              first_name: 'Teresa',        last_name: 'Venter',            email: 'teresa.venter@wearcheckrs.com',   job_title: 'Administration Assistant' },
  { employee_id: 'WEC132',  full_name: 'Thapelo Mohlala',            first_name: 'Thapelo',       last_name: 'Mohlala',           email: 'thapelo@wearcheckrs.com',         job_title: 'Reliability Technologist Trainee' },
  { employee_id: 'WC243',   full_name: 'Thomas Mithala',             first_name: 'Thomas',        last_name: 'Mithala',           email: 'thomas@wearcheckrs.com',          job_title: 'Reliability Technologist' },
  { employee_id: 'WEC062',  full_name: 'Thomas Malapa',              first_name: 'Thomas',        last_name: 'Malapa',            email: 'malapat@wearcheckrs.com',         job_title: 'Machine Inspector Level 1 Mech' },
  { employee_id: 'WEC057',  full_name: 'Tonny Simelani',             first_name: 'Tonny',         last_name: 'Simelani',          email: 'tonny@wearcheckrs.com',           job_title: 'Reliability Technologist' },
  { employee_id: 'WEC402',  full_name: 'Daniel Molapo',              first_name: 'Daniel',        last_name: 'Molapo',            email: 'daniel@wearcheckrs.com',          job_title: 'Oil Sampling Administrator' },
  { employee_id: 'WEC133',  full_name: 'Tsietsi Monnanyane',         first_name: 'Tsietsi',       last_name: 'Monnanyane',        email: 'tsietsi@wearcheckrs.com',         job_title: 'Precision Maintenance Technician' },
  { employee_id: 'WEC128',  full_name: 'Wihan Willer',               first_name: 'Wihan',         last_name: 'Willer',            email: 'wihan@wearcheckrs.com',           job_title: 'Reliability Technologist Trainee' },
];

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT LOGIC
// Strategy: match by email first (most reliable), then by employee_id.
// - If a match is found → update name, employee_id, and job_title.
// - If no match is found → insert as new record.
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
    console.log('\n══════════════════════════════════════════════');
    console.log(' Personnel Upsert — WCK Equipment Store');
    console.log('══════════════════════════════════════════════');
    console.log(`  Supabase URL : ${SUPABASE_URL}`);
    console.log(`  Records      : ${PERSONNEL.length}\n`);

    // Fetch all existing personnel (id, employee_id, email)
    const { data: existing, error: fetchErr } = await supabase
        .from('personnel')
        .select('id, employee_id, email, full_name');

    if (fetchErr) {
        console.error('Failed to fetch existing personnel:', fetchErr.message);
        process.exit(1);
    }

    // Build lookup maps
    const byEmail = new Map();
    const byCode  = new Map();
    for (const p of existing) {
        if (p.email) byEmail.set(p.email.toLowerCase(), p);
        byCode.set(p.employee_id?.toLowerCase(), p);
    }

    const results = { inserted: [], updated: [], skipped: [], errors: [] };

    for (const person of PERSONNEL) {
        try {
            const emailKey = person.email?.toLowerCase();
            const codeKey  = person.employee_id.toLowerCase();

            // Match by email first, then by employee_id
            const existing_record =
                (emailKey && byEmail.get(emailKey)) ||
                byCode.get(codeKey) ||
                null;

            const payload = {
                employee_id : person.employee_id,
                full_name   : person.full_name,
                first_name  : person.first_name,
                last_name   : person.last_name,
                email       : person.email || null,
                job_title   : person.job_title,
                is_active   : true,
            };

            if (existing_record) {
                // UPDATE
                const { error: updErr } = await supabase
                    .from('personnel')
                    .update(payload)
                    .eq('id', existing_record.id);

                if (updErr) throw new Error(updErr.message);
                results.updated.push(`${person.full_name} (${person.employee_id})`);
            } else {
                // INSERT
                const { error: insErr } = await supabase
                    .from('personnel')
                    .insert(payload);

                if (insErr) {
                    // Handle duplicate employee_id conflict gracefully
                    if (insErr.code === '23505' || insErr.message?.includes('duplicate') || insErr.message?.includes('unique')) {
                        results.skipped.push(`${person.full_name} (${person.employee_id}) — duplicate key, skipped`);
                    } else {
                        throw new Error(insErr.message);
                    }
                } else {
                    results.inserted.push(`${person.full_name} (${person.employee_id})`);
                }
            }
        } catch (err) {
            results.errors.push(`${person.full_name} (${person.employee_id}): ${err.message}`);
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log(`✅  Inserted : ${results.inserted.length}`);
    results.inserted.forEach(n => console.log(`    + ${n}`));

    console.log(`\n🔄  Updated  : ${results.updated.length}`);
    results.updated.forEach(n => console.log(`    ~ ${n}`));

    if (results.skipped.length) {
        console.log(`\n⚠️   Skipped  : ${results.skipped.length}`);
        results.skipped.forEach(n => console.log(`    ! ${n}`));
    }

    if (results.errors.length) {
        console.log(`\n❌  Errors   : ${results.errors.length}`);
        results.errors.forEach(n => console.log(`    ✗ ${n}`));
    }

    console.log('\n══════════════════════════════════════════════');
    console.log(` Done. ${results.inserted.length} added, ${results.updated.length} updated.`);
    console.log('══════════════════════════════════════════════\n');
}

run().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
