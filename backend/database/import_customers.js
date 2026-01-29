// Customer Import Script
// This script parses the tab-separated customer data and imports it to the database

const pool = require('./db');

const customerData = `Display Name	Customer Number	Currency Code	Billing City	Billing State	Billing Country	Shipping City	Shipping State	Shipping Country	Tax Registration Number	VAT Treatment	EmailID
A Siwele General Services	CUS-00002	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa		vat_not_registered	giftmsimeki3@gmail.com
ABACO Offshore Limited	1SS504	USD	Kuala	Wilayah Persekutuan Kuala Lumpur	Malaysia	Löhne		Germany		overseas	gabriel.tungo@bumiarmada.com
Abengoa Solar Power South Africa (Pty) Ltd - Xina O & M Company	CUS-00004	ZAR	Cape Town	Western Cape	South Africa	Cape Town	Western Cape	South Africa	4250279033	vat_registered	jodine.waterboer@abengoa.com
AECI Mining Chemicals, a division of AECI Mining Ltd	2SE106	ZAR	Sasolburg	Free State	South Africa	Johannesburg	Gauteng	South Africa	4140211857	vat_registered	neels.vanvuuren@aeciworld.com
African  Oxygen Limited t/a Afrox	1AF201	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4120110541	vat_registered	
Air Liquide Large Industries (Pty) Ltd	2AI106	ZAR	Johannesburg	Gauteng	South Africa			Belgium	4480103177	vat_registered	
Air Products South Africa (Pty) Ltd	CUS-00008	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4020120673	vat_registered	sandiso.mngadi@airproducts.co.za
Air Rotory Services (Pty) Ltd	CUS-00009	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4470274590	vat_registered	Retha@airrotoryservices.co.za
Almec Manufacturing (Pty) Ltd	CUS-00010	ZAR	Klerksdorp	North West	South Africa	Uraniaville		South Africa	4300112838	vat_registered	heino@almecmanufacturing.co.za
Ana-Digi Systems (Pty) Ltd	CUS-00011	ZAR	Johannesburg	Gauteng	South Africa		Antwerpen	Belgium	4160103661	vat_registered	hanneleze@anadigi.co.za
Valterra Platinum Limited - Precious Metals Refineries	CUS-00012	ZAR	Rustenburg	North-West	South Africa	Rustenburg	North-West	South Africa	4310113883	vat_registered	freddie.mocke@valterraplatinum.com
ArcelorMittal South Africa Limited LSP - Newcastle	CUS-00013	ZAR		Lourches	France			France	4920114990	vat_registered	
Ardagh Glass Packaging (Pty) Ltd -  Clayville	2CO303	ZAR	Johannesburg	Gauteng	South Africa			South Africa	4890235403	vat_registered	
Ardagh Glass Packaging (Pty) Ltd - Nigel	CUS-00015	ZAR		Gauteng	South Africa	Pretoriusstad	Gauteng	Netherlands	4890235403	vat_registered	gerrie.cloete@ardaghgroup.com
Ardagh Glass Packaging (Pty) Ltd - Olifantsfontein	CUS-00016	ZAR			South Africa	Johannesburg	Gauteng	South Africa	4890235403	vat_registered	Vongani.Mkhabele@ardaghgroup.com
Ardagh Glass Packaging (Pty) Ltd - Wadeville	CUS-00017	ZAR	Germiston	Gauteng	South Africa	Germiston	Gauteng	South Africa	4890235403	vat_registered	Neo.Leepile@ardaghgroup.com
Assmang Iron Ore - Khumani Mine	CUS-00018	ZAR	Johannesburg	Gauteng	South Africa	Kuruman		South Africa	4310113883	vat_registered	Keitumetse.Komet@assmang.co.za
Astec Industries South Africa (Pty) Ltd	CUS-00019	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4570189573	vat_registered	fventer@astecindustries.com
Atlantica South Africa Operations (Pty) Ltd	CUS-00020	ZAR	Upington	Northern Cape	South Africa	Upington	Northern Cape		4470302003	vat_registered	gillnorishia.lategaan@abengoa.com
Blendcor (Pty) Ltd	CUS-00021	ZAR	Bluff	Kwazulu-Natal	South Africa	Bluff	Kwazulu-Natal	South Africa	4730133743	vat_registered	Bobby.Pillay@blendcor.co.za
Blue Mining Services (Pty) Ltd	CUS-00022	ZAR	Middelburg	Mpumalanga	South Africa	Middelburg	Mpumalanga	South Africa		vat_not_registered	
Candex South Africa (Pty) Ltd	CUS-00023	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4870231125	vat_registered	palesa.mothale@alstomgroup.com
CBI Electric African Cables (Pty) Ltd	CUS-00024	ZAR	Johannesburg	Gauteng	South Africa	Vereeniging		South Africa	4750215859	vat_registered	enock.ngubane@cbi-electric.com
City of Cape Town	CUS-00025	ZAR	Bellville	Western Cape	South Africa				4500193497	vat_registered	Siyabonga.Manyamalala@capetown.gov.za
Clover SA (Pty) Ltd	CUS-00026	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4960141853	vat_registered	wesley.botes@clover.co.za
CNNC Rössing Uranium	CUS-00027	NAD	Arandis	Windhoek	Namibia		Arandis	Namibia		vat_not_registered	Kenneth.Strauss@Rossing.com.na
Cofco International Standerton Oil Mills (Pty) Ltd	CUS-00028	ZAR	Standerton	Mpumalanga	South Africa	Standerton		South Africa	4780262830	vat_registered	BasilHolloway@cofcointernational.com
Columbus Stainless (Pty) Ltd	CUS-00029	ZAR	Middelburg	Mpumalanga	South Africa	Middelburg	Mpumalanga	South Africa	4640196368	vat_registered	wilson.robin@columbus.co.za
Concor Construction (Pty) Ltd	CUS-00030	ZAR	Johannesburg	Gauteng	South Africa			South Africa	4310110764	vat_registered	dave.timm@concor.co.za
Corruseal Corrugated - Gauteng	CUS-00032	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4130107297	vat_registered	thembi@corruseal.co.za
D & S Crane & Plant Hire cc	CUS-00033	ZAR	Richards Bay	Kwazulu-Natal	South Africa			Netherlands		vat_not_registered	admin@dands.co.za
David Brown Santasalo SA (Pty) Ltd	CUS-00034	ZAR	Johannesburg	Gauteng	South Africa	Lockwood		United Kingdom		vat_not_registered	Thato.Diale@dbsantasalo.com
De Aar Solar Power (RF) (Pty) Ltd	CUS-00035	ZAR	Claremont	Western Cape	South Africa	De Aar		South Africa	4920261817	vat_registered	sulana.dejager@globeleq.co.za
De Beers Marine Namibia (Pty) Ltd	CUS-00036	ZAR	Windhoek	Khomas Region	Namibia	Dr. Frans Indongo Street		Namibia	4520131816	vat_registered	Jaco.vanHeerden@debmarine.com
Diesel Innovations (Pty) Ltd	CUS-00037	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4330198146	vat_registered	
Drivetek Engineeing (Pty) Ltd	CUS-00038	ZAR	Westmead	Kwazulu-Natal	South Africa	Westmead	Kwazulu-Natal		4470284540	vat_registered	kevinw@technidrives.co.za
DRS Innovative Mining Solutions	CUS-00039	USD	Lubumbashi	Katanga	Democratic Republic of Congo	Mühlgasse 18-20		Germany		overseas	Marat.Tulegenov@ergafrica.com
Dürr Africa (Pty) Ltd - Balancing & Assembly Products	CUS-00040	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa		vat_not_registered	
Dwarsrivier Chrome mine (Pty) Ltd	CUS-00041	ZAR	Lydenburg	Limpopo	South Africa	Steelpoort	Limpopo	South Africa	4210272078	vat_registered	jacoh@dwarsrivier.co.za
Dynatec - Madagascar SA	CUS-00042	USD		Toamasina	Madagascar		Toamasina	Madagascar		overseas	Manitra.Razafindraibe@ambatovy.mg
Elite Truck Hire	CUS-00043	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4130141197	vat_registered	lesleyp@elitetruck.co.za
Engie - Peakers Operations (Pty) Ltd	CUS-00044	ZAR	Durban	Kwazulu-Natal	South Africa	uMhlanga	Umhlanga Ridge	South Africa	4580269977	vat_registered	natasha.james@engie.com
Engie - Kathu Operations (Pty) Ltd	CUS-00045	ZAR	Kathu	Northern Cape	South Africa	Kathu	Northern Cape	South Africa	4420278790	vat_registered	nomathamsanqa.mdlela@engie.com
Everest Equipment And Control cc	CUS-00046	ZAR	Durban	Kwazulu-Natal	South Africa					vat_not_registered	ran@everestsa.net
F Momberg BK t/a CMS Condition Monitoring Services	CUS-00047	ZAR	Nelspruit (Mbombela)	Mpumalanga	South Africa				4490194711	vat_registered	accounts@comoserv.com
Firmenich (Pty) Ltd - Firsouth	CUS-00048	ZAR	Johannesburg	Gauteng	South Africa	Hounslow		United Kingdom	4760105330	vat_registered	morongoa.maponya@dsm-firmenich.com
Firmenich (Pty) Ltd - Firzar	CUS-00049	ZAR	Johannesburg	Gauteng	South Africa	Hounslow		United Kingdom	4760105330	vat_registered	Sibongile.Maluleka@firmenich.com
Fixturlaser South Africa (Pty) Ltd	CUS-00050	ZAR	Johannesburg	Gauteng	South Africa	Johannesburg	Gauteng	South Africa	4320268784	vat_registered	gerrit@fixturlaser.co.za`;

async function importCustomers() {
    const lines = customerData.trim().split('\n');
    const headers = lines[0].split('\t');
    
    console.log('Headers:', headers);
    console.log('Total rows to import:', lines.length - 1);
    
    // Prepare the schema updates first
    await pool.query(`
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_state VARCHAR(100);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(100);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100);
    `);
    
    // Clear existing customers
    await pool.query('TRUNCATE TABLE customers RESTART IDENTITY CASCADE');
    
    let imported = 0;
    let errors = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length < 2) continue;
        
        const displayName = cols[0]?.trim() || '';
        const customerNumber = cols[1]?.trim() || '';
        const currencyCode = cols[2]?.trim() || 'ZAR';
        const billingCity = cols[3]?.trim() || null;
        const billingState = cols[4]?.trim() || null;
        const billingCountry = cols[5]?.trim() || null;
        const shippingCity = cols[6]?.trim() || null;
        const shippingState = cols[7]?.trim() || null;
        const shippingCountry = cols[8]?.trim() || null;
        const vatNumber = cols[9]?.trim() || null;
        const vatTreatment = cols[10]?.trim() || 'vat_not_registered';
        const email = cols[11]?.trim() || null;
        
        // Determine region based on currency and VAT treatment
        const region = (currencyCode !== 'ZAR' || vatTreatment === 'overseas') ? 'Overseas' : 'Local';
        
        try {
            await pool.query(`
                INSERT INTO customers (customer_number, display_name, currency_code, city, billing_city, province_state, billing_state, country, billing_country, shipping_city, shipping_state, shipping_country, vat_number, vat_treatment, email, region)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                ON CONFLICT (customer_number) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    email = EXCLUDED.email
            `, [customerNumber, displayName, currencyCode, billingCity, billingCity, billingState, billingState, billingCountry, billingCountry, shippingCity, shippingState, shippingCountry, vatNumber, vatTreatment, email, region]);
            imported++;
        } catch (err) {
            console.error(`Error importing ${displayName}:`, err.message);
            errors++;
        }
    }
    
    console.log(`\nImport complete: ${imported} customers imported, ${errors} errors`);
    
    // Show summary
    const result = await pool.query(`
        SELECT 
            region,
            COUNT(*) as count
        FROM customers
        GROUP BY region
        ORDER BY region
    `);
    
    console.log('\nCustomer summary:');
    result.rows.forEach(row => {
        console.log(`  ${row.region}: ${row.count}`);
    });
    
    await pool.end();
}

importCustomers().catch(err => {
    console.error('Import failed:', err);
    pool.end();
});
