const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 55, right: 55 },
  info: {
    Title: 'WCK Equipment Store - Handover Guide',
    Author: 'Wearcheck Reliability Solutions',
    Subject: 'Quick Handover Reference for the Equipment Store Application',
  },
  bufferPages: true,
});

const output = fs.createWriteStream('WCK_Equipment_Store_Handover_Guide.pdf');
doc.pipe(output);

const C = {
  primary: '#1a56db',
  primaryLight: '#e8eefb',
  dark: '#1e293b',
  body: '#374151',
  muted: '#6b7280',
  accent: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  white: '#ffffff',
  border: '#e2e8f0',
};

function addFooter() {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.fontSize(8).fillColor(C.muted);
    doc.text(
      `WCK Equipment Store - Handover Guide  |  Page ${i + 1}`,
      55, doc.page.height - 40,
      { align: 'center', width: doc.page.width - 110 }
    );
    doc.restore();
  }
}

function heading(text, level = 1) {
  if (level === 1) {
    doc.moveDown(0.5);
    doc.fontSize(20).fillColor(C.primary).font('Helvetica-Bold').text(text);
    doc.moveTo(55, doc.y + 4).lineTo(doc.page.width - 55, doc.y + 4).strokeColor(C.primary).lineWidth(2).stroke();
    doc.moveDown(0.7);
  } else {
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(C.dark).font('Helvetica-Bold').text(text);
    doc.moveTo(55, doc.y + 2).lineTo(250, doc.y + 2).strokeColor(C.border).lineWidth(1).stroke();
    doc.moveDown(0.4);
  }
}

function body(text) {
  doc.fontSize(10).fillColor(C.body).font('Helvetica').text(text, { lineGap: 3 });
  doc.moveDown(0.3);
}

function numberedItem(num, text) {
  doc.fontSize(10).fillColor(C.body).font('Helvetica');
  doc.text(`${num}.  ${text}`, 65, doc.y, { lineGap: 2, width: doc.page.width - 120 });
  doc.moveDown(0.15);
}

function bullet(text) {
  doc.fontSize(10).fillColor(C.body).font('Helvetica');
  doc.text(`\u2022  ${text}`, 65, doc.y, { lineGap: 2, width: doc.page.width - 120 });
  doc.moveDown(0.15);
}

function note(text) {
  const y = doc.y;
  const boxWidth = doc.page.width - 110;
  const textOpts = { width: boxWidth - 20 };
  const textHeight = doc.fontSize(9).heightOfString(text, textOpts);
  const boxHeight = textHeight + 18;
  doc.save();
  doc.roundedRect(55, y, boxWidth, boxHeight, 4).fill(C.primaryLight);
  doc.fontSize(9).fillColor(C.primary).font('Helvetica-Bold').text('NOTE: ', 65, y + 9, { continued: true });
  doc.font('Helvetica').fillColor(C.body).text(text, textOpts);
  doc.restore();
  doc.y = y + boxHeight + 6;
  doc.moveDown(0.3);
}

function tip(text) {
  const y = doc.y;
  const boxWidth = doc.page.width - 110;
  const textOpts = { width: boxWidth - 20 };
  const textHeight = doc.fontSize(9).heightOfString(text, textOpts);
  const boxHeight = textHeight + 18;
  doc.save();
  doc.roundedRect(55, y, boxWidth, boxHeight, 4).fill('#ecfdf5');
  doc.fontSize(9).fillColor(C.accent).font('Helvetica-Bold').text('TIP: ', 65, y + 9, { continued: true });
  doc.font('Helvetica').fillColor(C.body).text(text, textOpts);
  doc.restore();
  doc.y = y + boxHeight + 6;
  doc.moveDown(0.3);
}

function checkPageSpace(needed = 120) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - needed) {
    doc.addPage();
  }
}

// ═══════════════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════════════
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.primary);
doc.fontSize(36).fillColor(C.white).font('Helvetica-Bold')
  .text('Equipment Store', 55, 190, { align: 'center' });
doc.fontSize(18).fillColor('#93c5fd').font('Helvetica')
  .text('Handover Guide', { align: 'center' });
doc.moveDown(1.5);
doc.fontSize(13).fillColor('#bfdbfe')
  .text('Prepared for: Megan Salzwedel', { align: 'center' });
doc.moveDown(2.5);
doc.fontSize(10).fillColor('#93c5fd')
  .text('Wearcheck Reliability Solutions', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(9).fillColor('#93c5fd')
  .text('September 2026', { align: 'center' });

// ═══════════════════════════════════════════════
// PAGE 2: WHY YOU'RE GETTING THIS + ACCESS
// ═══════════════════════════════════════════════
doc.addPage();
heading('While I\'m Away');
body('You already have full Admin access to the Equipment Store (login: WEC104), so you can do everything below without needing anyone to change your permissions.');
body('This is a quick reference for the 4 things you\'ll most likely need to do: check equipment, add equipment, export data, and add calibration records. The full User Guide (attached separately) covers every feature in more detail - forward that one to anyone who has general "how do I..." questions.');

note('Before I left, I went through every calibration certificate on OneDrive and on WearCheckArc.com and updated the equipment records to match as best I could. Some items may still be missing a certificate or not yet allocated to anyone - see the last section for what to do if you spot one of these.');

// ═══════════════════════════════════════════════
// SECTION 1: CHECK EQUIPMENT
// ═══════════════════════════════════════════════
checkPageSpace(200);
heading('1. Checking Equipment');
body('Go to the "Equipment" page from the main menu.');
numberedItem(1, 'Use the search bar to find an item by ID, name, serial number, location, or holder name.');
numberedItem(2, 'Use the dropdown filters to narrow the list down: Status (Available/Checked Out), Category, Calibration status (Calibrated/Due Soon/Expired/Not Calibrated), or Channels.');
numberedItem(3, 'Click an Equipment ID (or the "View" button) to open its full details page, which shows tabs for Details, Calibration history, Movement History, and Images.');
numberedItem(4, 'The Status and Calibration badges on the list and detail page tell you at a glance whether an item is available, checked out, and whether its calibration is Valid, Due Soon, Expired, or Not Calibrated.');
tip('If you\'re checking whether a specific item\'s calibration is up to date, the fastest way is to search for it on the Equipment page and look at the Calibration badge - no need to open the Calibration page separately.');

// ═══════════════════════════════════════════════
// SECTION 2: ADD EQUIPMENT
// ═══════════════════════════════════════════════
checkPageSpace(220);
heading('2. Adding Equipment');
body('From the Equipment page, click "Add Equipment" (single item) or "Import" (bulk, via Excel).');
heading('Adding a single item', 2);
numberedItem(1, 'Equipment ID is auto-generated from Category + Manufacturer - you can leave it as-is.');
numberedItem(2, 'Fill in Equipment Name, Category, Subcategory, Manufacturer, and Model (all required).');
numberedItem(3, 'If the item has its own serial number, tick "Serialised Equipment" and enter it - the system checks for duplicates as you type.');
numberedItem(4, 'If it\'s a stocked/consumable item instead, tick "Track Quantity" and enter the quantity and unit.');
numberedItem(5, 'Set the Current Location - either an internal branch/location, or a customer site.');
numberedItem(6, 'Click Save.');
heading('Adding equipment in bulk', 2);
numberedItem(1, 'Click "Import" on the Equipment page.');
numberedItem(2, 'Click "Download Template" to get a blank Excel template with the correct column headers.');
numberedItem(3, 'Fill in the template (Equipment ID, Name, Category, Subcategory, Location are required; Manufacturer/Model/Serial Number/Description/Notes are optional).');
numberedItem(4, 'Select the completed file and click "Import" - you\'ll get a per-row success/error report.');

// ═══════════════════════════════════════════════
// SECTION 3: EXPORT DATA
// ═══════════════════════════════════════════════
checkPageSpace(200);
heading('3. Exporting Data');
body('There are two places to export from:');
bullet('Reports page: choose a tab (Overdue, Checked Out, Available, Low Stock, By Category, By Location, Calibration Due, Monthly Audit, etc.), then click "Export" and choose CSV, Excel, or PDF.');
bullet('Equipment page or Calibration page: click "Export" to download exactly the list currently on screen (respects your search/filters) in CSV, Excel, or PDF.');
tip('If someone asks for "everything expiring soon", filter the Equipment page by Calibration = Due Soon (or use the Reports page\'s "Calibration Due" tab) before exporting - the export only includes what\'s currently filtered/visible.');

// ═══════════════════════════════════════════════
// SECTION 4: ADD CALIBRATION
// ═══════════════════════════════════════════════
checkPageSpace(220);
heading('4. Adding a Calibration Record');
body('You can do this from either place:');
bullet('The Calibration page: click "+ Add Calibration Record" next to the item.');
bullet('An item\'s own Detail page: open its Calibration tab and click "+ Add Calibration".');
heading('Fields to fill in', 2);
numberedItem(1, 'Calibration Date and Expiry Date (required, format DD/MM/YYYY).');
numberedItem(2, 'Certificate Number and Calibration Provider (who calibrated it) - not required, but fill these in whenever the certificate has them.');
numberedItem(3, 'Certificate File - upload the PDF or image of the certificate (PDF, JPG, PNG, TIFF, DOC/DOCX, max 10MB).');
numberedItem(4, 'Notes - optional, use for anything unusual (e.g. certificate found late, re-issued cert, etc.).');
numberedItem(5, 'Click "Save Calibration Record". The item\'s status badge updates automatically based on the new expiry date.');
note('The status is always worked out from whichever calibration record has the most recent Calibration Date - so if you\'re correcting an old record, add a NEW record with the right dates rather than editing history. You can see the full history via "History" (Calibration page) or the item\'s Calibration tab.');

// ═══════════════════════════════════════════════
// SECTION 5: IF SOMETHING IS MISSING OR UNALLOCATED
// ═══════════════════════════════════════════════
checkPageSpace(260);
heading('5. If You Find Something Missing or Unallocated');
body('While reviewing OneDrive and WearCheckArc.com, I updated as many equipment and calibration records as I could match up. A few things may still slip through - here\'s what to do if you spot one:');
numberedItem(1, 'Missing or expired calibration certificate: search the item on WearCheckArc.com and OneDrive first - if you find the certificate, add it as a new Calibration Record (Section 4). If you genuinely can\'t find one, leave the item as "Not Calibrated"/"Expired" and make a note - do not guess dates.');
numberedItem(2, 'Item not allocated to anyone (no current holder): this usually just means it\'s sitting in storage/available - that\'s normal and doesn\'t need action. Only chase it up if you have reason to believe someone actually has it (e.g. a manager mentions it) - in that case, use Check Out to allocate it to the correct person.');
numberedItem(3, 'Anything you\'re unsure about (wrong location, wrong holder, category looks off, duplicate-looking entry): you have Admin access, so go ahead and correct it directly via the Equipment Detail page - no need to wait for anyone else to make the change.');
tip('You\'re one of the people the system already notifies (along with Andrew Robb) whenever an unassigned item\'s calibration is coming due - so if you get one of those reminders, that\'s your cue to check/allocate that specific item.');

// ═══════════════════════════════════════════════
// SECTION 6: GENERAL USER GUIDE
// ═══════════════════════════════════════════════
checkPageSpace(160);
heading('6. General User Guide');
body('A full "WCK Equipment Store User Guide" PDF is attached alongside this handover - it covers Check Out/In, Consumables, Maintenance, Reservations, Audit Log, User Management, and Reports in more detail. Feel free to forward that one on to anyone who asks how to use the app.');

addFooter();
doc.end();

output.on('finish', () => {
  console.log('Handover guide generated: WCK_Equipment_Store_Handover_Guide.pdf');
});
