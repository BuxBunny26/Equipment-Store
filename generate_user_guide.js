const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 55, right: 55 },
  info: {
    Title: 'WCK Equipment Store - User Guide',
    Author: 'Wearcheck Reliability Solutions',
    Subject: 'How-To Guide for the Equipment Store Application',
  },
  bufferPages: true,
});

const output = fs.createWriteStream('WCK_Equipment_Store_User_Guide.pdf');
doc.pipe(output);

// ── Colour palette ──
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
  bg: '#f8fafc',
  border: '#e2e8f0',
  sectionBg: '#f1f5f9',
};

let pageNum = 0;

// ── Helpers ──
function addFooter() {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.fontSize(8).fillColor(C.muted);
    doc.text(
      `WCK Equipment Store - User Guide  |  Page ${i + 1}`,
      55, doc.page.height - 40,
      { align: 'center', width: doc.page.width - 110 }
    );
    doc.restore();
  }
}

function heading(text, level = 1) {
  if (level === 1) {
    doc.moveDown(0.5);
    doc.fontSize(22).fillColor(C.primary).font('Helvetica-Bold').text(text);
    doc.moveTo(55, doc.y + 4).lineTo(doc.page.width - 55, doc.y + 4).strokeColor(C.primary).lineWidth(2).stroke();
    doc.moveDown(0.8);
  } else if (level === 2) {
    doc.moveDown(0.6);
    doc.fontSize(16).fillColor(C.dark).font('Helvetica-Bold').text(text);
    doc.moveTo(55, doc.y + 2).lineTo(250, doc.y + 2).strokeColor(C.border).lineWidth(1).stroke();
    doc.moveDown(0.5);
  } else {
    doc.moveDown(0.4);
    doc.fontSize(13).fillColor(C.dark).font('Helvetica-Bold').text(text);
    doc.moveDown(0.3);
  }
}

function body(text) {
  doc.fontSize(10).fillColor(C.body).font('Helvetica').text(text, { lineGap: 3 });
  doc.moveDown(0.3);
}

function bullet(text, indent = 0) {
  const x = 65 + indent * 15;
  const marker = indent === 0 ? '\u2022' : '\u25E6';
  doc.fontSize(10).fillColor(C.body).font('Helvetica');
  doc.text(`${marker}  ${text}`, x, doc.y, { indent: 0, lineGap: 2, width: doc.page.width - x - 55 });
  doc.moveDown(0.15);
}

function numberedItem(num, text) {
  doc.fontSize(10).fillColor(C.body).font('Helvetica');
  doc.text(`${num}.  ${text}`, 65, doc.y, { lineGap: 2, width: doc.page.width - 120 });
  doc.moveDown(0.15);
}

function tip(text) {
  const y = doc.y;
  const boxWidth = doc.page.width - 110;
  doc.save();
  doc.roundedRect(55, y, boxWidth, 30, 4).fill('#ecfdf5');
  doc.fontSize(9).fillColor(C.accent).font('Helvetica-Bold').text('TIP: ', 65, y + 9, { continued: true });
  doc.font('Helvetica').fillColor(C.body).text(text, { width: boxWidth - 20 });
  doc.restore();
  doc.y = y + 36;
  doc.moveDown(0.3);
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

function warning(text) {
  const y = doc.y;
  const boxWidth = doc.page.width - 110;
  const textOpts = { width: boxWidth - 20 };
  const textHeight = doc.fontSize(9).heightOfString(text, textOpts);
  const boxHeight = textHeight + 18;
  doc.save();
  doc.roundedRect(55, y, boxWidth, boxHeight, 4).fill('#fef3c7');
  doc.fontSize(9).fillColor(C.warning).font('Helvetica-Bold').text('WARNING: ', 65, y + 9, { continued: true });
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
doc.fontSize(42).fillColor(C.white).font('Helvetica-Bold')
  .text('Equipment Store', 55, 200, { align: 'center' });
doc.fontSize(18).fillColor('#93c5fd').font('Helvetica')
  .text('User Guide', { align: 'center' });
doc.moveDown(2);
doc.fontSize(12).fillColor('#bfdbfe')
  .text('Wearcheck Reliability Solutions', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).fillColor('#93c5fd')
  .text('wckequipment-store.netlify.app', { align: 'center' });
doc.moveDown(4);
doc.fontSize(10).fillColor('#bfdbfe')
  .text('Version 1.0  |  April 2026', { align: 'center' });

// ═══════════════════════════════════════════════
// TABLE OF CONTENTS
// ═══════════════════════════════════════════════
doc.addPage();
heading('Table of Contents');

const tocItems = [
  '1.  Getting Started',
  '2.  Dashboard',
  '3.  Equipment List',
  '4.  Equipment Detail',
  '5.  Check Out',
  '6.  Check In',
  '7.  Reservations',
  '8.  Reports',
  '9.  Customer Sites',
  '10. Consumables',
  '11. Calibration',
  '12. Maintenance',
  '13. Equipment Analytics',
  '14. Assets Dashboard',
  '15. Asset Analytics',
  '16. Laptop Assignments',
  '17. Cellphone Assignments',
  '18. Vehicles',
  '19. Vehicle Pre-Trip Form',
  '20. User Management (Admin)',
  '21. Audit Log',
  '22. Settings',
];

tocItems.forEach(item => {
  doc.fontSize(11).fillColor(C.dark).font('Helvetica').text(item, 70);
  doc.moveDown(0.25);
});

// ═══════════════════════════════════════════════
// 1. GETTING STARTED
// ═══════════════════════════════════════════════
doc.addPage();
heading('1. Getting Started');

heading('Accessing the Application', 2);
body('Open your web browser and navigate to wckequipment-store.netlify.app. The application works on desktop, tablet, and mobile devices.');

heading('Selecting Your Operator Profile', 2);
body('When you first open the site, an Operator Selection modal appears. This identifies who is performing actions in the system.');
numberedItem(1, 'The modal displays a searchable list of all personnel in the system.');
numberedItem(2, 'Type your name or scroll to find yourself.');
numberedItem(3, 'Click your name to select it, then confirm.');
numberedItem(4, 'Your name appears in the sidebar under the logo for the rest of your session.');
doc.moveDown(0.3);
note('You can change your operator profile at any time by clicking on your name in the sidebar.');

heading('Navigation', 2);
body('The sidebar on the left organises all pages into four sections:');
doc.moveDown(0.2);
bullet('Equipment: Dashboard, Analytics, Equipment List, Check Out, Check In, Reservations, Reports, Customer Sites');
bullet('Operations: Consumables, Calibration, Maintenance');
bullet('Assets: Dashboard, Analytics, Laptops, Cellphones, Vehicles, Pre-Trip Form');
bullet('System: Users (admin only), Audit Log, Settings');
doc.moveDown(0.3);
body('On mobile devices, tap the hamburger menu icon at the top-left to open the sidebar.');

heading('Roles & Permissions', 2);
body('The system recognises the following roles:');
bullet('Admin: Full access to all pages including User Management.');
bullet('Manager: Can approve/reject reservations and manage equipment.');
bullet('Technician: Can check out/in equipment and manage consumables.');
bullet('Viewer: Read-only access to dashboards and reports.');

// ═══════════════════════════════════════════════
// 2. DASHBOARD
// ═══════════════════════════════════════════════
doc.addPage();
heading('2. Dashboard');
body('The Dashboard is your landing page. It provides a real-time overview of the entire system at a glance.');

heading('Summary Cards', 2);
body('At the top you will see key metric cards:');
bullet('Total Equipment: Count of all equipment in the system.');
bullet('Available: Equipment ready for checkout.');
bullet('Checked Out: Equipment currently in the field.');
bullet('Overdue: Equipment past its expected return date.');
bullet('Consumables: Total consumable items and low-stock count.');

heading('Calibration Summary', 2);
body('Colour-coded cards showing the calibration health of your fleet:');
bullet('Valid (green): Calibration is current.');
bullet('Due Soon (orange): Calibration expires within 30 days.');
bullet('Expired (red): Calibration has lapsed.');
bullet('Not Calibrated (grey): No calibration record on file.');

heading('Maintenance Overview', 2);
body('Displays counts of maintenance items due and overdue, plus a list of the next 5 upcoming maintenance tasks.');

heading('Reservation Stats', 2);
body('Shows pending approvals, active reservations, and any reservation activity for today.');

heading('Recent Activity', 2);
body('A timeline of the most recent equipment movements (check-outs and check-ins) with timestamps and personnel names.');

heading('Alerts Panel', 2);
body('Displays active notifications including vehicle fines, overdue equipment, low-stock consumables, and calibration expiry warnings.');

// ═══════════════════════════════════════════════
// 3. EQUIPMENT LIST
// ═══════════════════════════════════════════════
doc.addPage();
heading('3. Equipment List');
body('The Equipment page is the master inventory register. It lists every piece of equipment and consumable in the system.');

heading('Searching & Filtering', 2);
body('Use the controls at the top of the page to narrow down results:');
bullet('Search box: Type equipment name or ID for instant filtering.');
bullet('Status filter: Show only Available or Checked Out items.');
bullet('Category filter: Filter by equipment category (e.g. Vibration, Oil Analysis).');
bullet('Consumable filter: Show only consumable or non-consumable items.');
bullet('Calibration filter: Find items by calibration status (Valid, Due Soon, Expired, Not Calibrated).');
doc.moveDown(0.2);
tip('Combine multiple filters together. For example, filter by "Available" + "Vibration" to see all available vibration equipment.');

heading('Table Columns', 2);
bullet('Equipment ID: Unique identifier.');
bullet('Name: Equipment description.');
bullet('Category: Technology/category grouping.');
bullet('Status: Colour-coded badge (green = Available, red = Checked Out).');
bullet('Calibration: Calibration status badge.');
bullet('Quantity: Current and total quantity (for tracked items).');
bullet('Location: Current storage location.');

heading('Adding Equipment', 2);
numberedItem(1, 'Click the "Add Equipment" button at the top-right.');
numberedItem(2, 'Fill in the form: Equipment ID, Name, Category, Description, and optional fields.');
numberedItem(3, 'Toggle "Is Consumable" if the item is a consumable supply.');
numberedItem(4, 'Set quantity and reorder level for tracked items.');
numberedItem(5, 'Click Save to add the equipment.');

heading('Importing Equipment', 2);
body('To bulk-add equipment from a spreadsheet:');
numberedItem(1, 'Click the Import button.');
numberedItem(2, 'Download the provided Excel template.');
numberedItem(3, 'Fill in your equipment data following the template columns.');
numberedItem(4, 'Upload the completed file.');
numberedItem(5, 'Review the preview and confirm the import.');

heading('Exporting', 2);
body('Click the Export button to download the equipment list as Excel or CSV. The export respects your current filters, so you can export a subset of equipment.');

heading('Other Actions', 2);
bullet('Click any equipment name to open its Detail page.');
bullet('Click the edit icon to modify an equipment record inline.');
bullet('Click the delete icon to remove an item (confirmation required).');

// ═══════════════════════════════════════════════
// 4. EQUIPMENT DETAIL
// ═══════════════════════════════════════════════
doc.addPage();
heading('4. Equipment Detail');
body('Click on any equipment name from the Equipment List to open its full detail page. The page is organised into tabs.');

heading('Details Tab', 2);
body('Shows all properties of the equipment item:');
bullet('Name, Equipment ID, Category, Description.');
bullet('Current Status and Location.');
bullet('Purchase date, asset number.');
bullet('Condition assessment and quantity details.');
bullet('Photo gallery (if images have been uploaded).');
doc.moveDown(0.2);
body('If the equipment is available, a "Check Out" button appears here for quick access.');

heading('History Tab', 2);
body('Displays the full movement history of the equipment:');
bullet('Date and time of each check-out and check-in.');
bullet('Personnel involved and destination/location.');
bullet('Condition at the time of each movement.');
bullet('Notes recorded during the transaction.');
doc.moveDown(0.2);
body('Up to 100 recent movements are shown.');

heading('Calibration Tab', 2);
body('Shows the calibration record for this specific item:');
bullet('Current calibration status badge and next due date.');
bullet('Link to view or download the current certificate (PDF).');
bullet('Full calibration history table with dates, providers, and certificate numbers.');

heading('Maintenance Tab', 2);
body('Lists all maintenance records associated with this equipment:');
bullet('Maintenance type, date performed, cost.');
bullet('Next scheduled maintenance date.');
bullet('Work order references.');

// ═══════════════════════════════════════════════
// 5. CHECK OUT
// ═══════════════════════════════════════════════
doc.addPage();
heading('5. Check Out');
body('The Check Out page guides you through issuing equipment to personnel, customers, or calibration labs.');

heading('Step 1: Select Equipment', 2);
numberedItem(1, 'Browse the list of available equipment.');
numberedItem(2, 'Use the search bar to find specific items.');
numberedItem(3, 'Tick the checkbox next to each item you want to check out (multi-select supported).');
doc.moveDown(0.2);
note('If you navigated here from an Equipment Detail page, that item will already be pre-selected.');

heading('Step 2: Enter Checkout Details', 2);
body('Select the destination type:');
bullet('Internal: Moving equipment to another storage location within the company.');
bullet('Customer: Deploying equipment to a customer site.');
bullet('Calibration: Sending equipment out for calibration.');
bullet('Transfer: Transferring equipment between company sites.');
doc.moveDown(0.2);
body('Depending on the destination, fill in the required fields:');
bullet('Location or Customer (dropdown).');
bullet('Expected return date.');
bullet('Personnel receiving the equipment.');

heading('Step 3: Condition Assessment', 2);
body('Record the condition of the equipment at the time of checkout:');
bullet('Select from: Excellent, Good, Fair, Poor, Damaged.');
bullet('If the condition is not Excellent, you must provide a reason.');
bullet('Optionally capture a photo using your device camera or file upload.');

heading('Step 4: Confirm', 2);
body('Review the checkout summary and click Confirm. A confirmation dialog appears before the record is saved.');
doc.moveDown(0.3);
warning('If the equipment has an active reservation that conflicts with your checkout dates, the system will warn you.');

// ═══════════════════════════════════════════════
// 6. CHECK IN
// ═══════════════════════════════════════════════
doc.addPage();
heading('6. Check In');
body('Use this page to return equipment that is currently checked out.');

heading('How to Check In Equipment', 2);
numberedItem(1, 'Open the Check In page from the sidebar.');
numberedItem(2, 'Select the equipment to return from the dropdown. Only currently checked-out items appear.');
numberedItem(3, 'Choose the return location from the dropdown.');
numberedItem(4, 'Assess the condition of the equipment (Excellent/Good/Fair/Poor/Damaged).');
numberedItem(5, 'If condition is not Excellent, enter a reason explaining any damage or wear.');
numberedItem(6, 'Optionally upload a photo documenting the current condition.');
numberedItem(7, 'Add any notes about the return.');
numberedItem(8, 'Click Submit to complete the return.');
doc.moveDown(0.3);
note('If the equipment was linked to an active reservation, the reservation status will automatically update to Completed.');

// ═══════════════════════════════════════════════
// 7. RESERVATIONS
// ═══════════════════════════════════════════════
doc.addPage();
heading('7. Reservations');
body('The Reservations page lets you book equipment for future use, preventing scheduling conflicts.');

heading('Summary Cards', 2);
body('At the top of the page, three cards display:');
bullet('Upcoming This Week: Reservations starting within the next 7 days.');
bullet('Pending Approval: Reservations waiting for manager approval.');
bullet('Active: Currently active reservations.');

heading('Creating a Reservation', 2);
numberedItem(1, 'Click "New Reservation".');
numberedItem(2, 'Select a Technology/Category to filter the equipment list.');
numberedItem(3, 'Select the Equipment from the filtered dropdown.');
numberedItem(4, 'Set the Start Date and End Date using the date pickers.');
numberedItem(5, 'The system immediately checks availability. If the equipment is free, a green "Available" message appears.');
numberedItem(6, 'Optionally select a Customer/Site if the reservation is for field deployment.');
numberedItem(7, 'Enter a Purpose and any Notes.');
numberedItem(8, 'Click Save.');
doc.moveDown(0.3);
warning('Double-booking is prevented. If someone else has already reserved the same equipment for overlapping dates, the system shows a red conflict alert listing who has it and when. The Save button is disabled until you choose different dates or a different item.');

heading('Reservation Status Workflow', 2);
body('Each reservation moves through these statuses:');
bullet('Pending: Just created, awaiting manager approval.');
bullet('Approved: Manager has approved the reservation.');
bullet('Active: The reservation period is currently in effect.');
bullet('Completed: Equipment has been returned / period ended.');
bullet('Cancelled: The reservation was cancelled by the requester or a manager.');
doc.moveDown(0.2);
note('Only managers and admins can change a reservation from Pending to Approved or Active.');

heading('Filtering Reservations', 2);
bullet('Status filter: View only Pending, Approved, Active, etc.');
bullet('Equipment filter: Search by equipment ID.');
bullet('Date range: Filter by start/end dates.');
bullet('By default, only active and upcoming reservations are shown (past completed ones are hidden).');

// ═══════════════════════════════════════════════
// 8. REPORTS
// ═══════════════════════════════════════════════
doc.addPage();
heading('8. Reports');
body('The Reports page provides pre-built views across all system data. Each report is accessed via a tab along the top.');

heading('Available Report Tabs', 2);

heading('Overdue Equipment', 3);
body('Lists all equipment that has been checked out past its expected return date. Shows the number of days overdue, who has the item, and the location.');

heading('Checked-Out Equipment', 3);
body('Shows all currently checked-out items with checkout date, holder, destination, and expected return date.');

heading('Available Equipment', 3);
body('Lists all equipment currently available for checkout, with location and condition.');

heading('Low Stock Consumables', 3);
body('Highlights consumable items where the current quantity is at or below the reorder level.');

heading('By Category', 3);
body('Breaks down equipment count by category with status distribution (available vs. checked out).');

heading('By Location', 3);
body('Breaks down equipment count by storage location with status distribution.');

heading('Usage Statistics', 3);
body('Shows total checkout counts per equipment item, most-used items, and personnel checkout patterns.');

checkPageSpace(200);
heading('Vehicles Report', 3);
body('Vehicle fleet summary including fine totals (paid and unpaid) and services performed or due.');

heading('Cellphones Report', 3);
body('Cellphone assignment status summary grouped by person.');

heading('Laptops Report', 3);
body('Laptop assignment status summary grouped by person.');

heading('Calibration Due', 3);
body('Lists equipment with expired calibration certificates or calibrations due within 30 days.');

heading('Exporting Reports', 2);
body('Every report tab has an Export button that lets you download the data as Excel (.xlsx) or CSV. The export contains only the data visible in the current report.');

// ═══════════════════════════════════════════════
// 9. CUSTOMER SITES
// ═══════════════════════════════════════════════
doc.addPage();
heading('9. Customer Sites');
body('This page tracks which equipment is deployed at which customer location.');

heading('Summary Cards', 2);
bullet('Total Customers: Number of customer records in the system.');
bullet('Customers with Equipment: Customers who currently have equipment deployed.');
bullet('Total Equipment Out: Count of all equipment items at customer sites.');

heading('Using the Page', 2);
numberedItem(1, 'Use the search bar to find a customer by name, city, or customer number.');
numberedItem(2, 'Click on a customer row to expand it and see their deployed equipment.');
numberedItem(3, 'The expanded section shows a table of equipment: Equipment ID, Name, Check-Out Date, and Status.');
numberedItem(4, 'Contact information for the customer is displayed alongside the equipment list.');

heading('Exporting', 2);
body('Export all customer data or a specific customer\'s equipment list as Excel or CSV.');

// ═══════════════════════════════════════════════
// 10. CONSUMABLES
// ═══════════════════════════════════════════════
doc.addPage();
heading('10. Consumables');
body('Consumables are items that get used up (e.g. oil sample bottles, cleaning supplies). This page manages their stock levels.');

heading('Stock Status Indicators', 2);
bullet('In Stock (green): Quantity is above the reorder level.');
bullet('Low Stock (orange): Quantity is at or near the reorder level.');
bullet('Out of Stock (red): Quantity is zero.');
doc.moveDown(0.2);
body('A warning banner at the top shows how many items are currently in low stock.');

heading('Searching & Filtering', 2);
bullet('Search: By name, equipment ID, category, or subcategory.');
bullet('Stock Status: Filter to show only In Stock, Low Stock, or Out of Stock items.');

heading('Issuing Consumables', 2);
numberedItem(1, 'Click the Issue button on the consumable row.');
numberedItem(2, 'Enter the quantity to issue.');
numberedItem(3, 'Select the location and personnel receiving the item.');
numberedItem(4, 'Add optional notes.');
numberedItem(5, 'Click Confirm. The available quantity decreases automatically.');

heading('Restocking Consumables', 2);
numberedItem(1, 'Click the Restock button on the consumable row.');
numberedItem(2, 'Enter the quantity being added.');
numberedItem(3, 'Optionally enter the supplier name and cost.');
numberedItem(4, 'Add notes if needed.');
numberedItem(5, 'Click Confirm. The available quantity increases.');
doc.moveDown(0.3);
tip('Both Issue and Restock actions are logged in the Audit Log for full traceability.');

// ═══════════════════════════════════════════════
// 11. CALIBRATION
// ═══════════════════════════════════════════════
doc.addPage();
heading('11. Calibration');
body('The Calibration page tracks the calibration status of all equipment and stores digital copies of certificates.');

heading('Summary Cards', 2);
bullet('Valid: Equipment with a current calibration certificate.');
bullet('Due Soon: Calibration expiring within 30 days.');
bullet('Expired: Calibration has lapsed and needs renewal.');
bullet('Not Calibrated: No calibration record on file.');

heading('Filtering', 2);
bullet('Search by equipment name or ID.');
bullet('Filter by status: Valid, Due Soon, Expired, Not Calibrated.');
bullet('Filter by equipment category.');

heading('Adding a Calibration Record', 2);
numberedItem(1, 'Click Add Calibration on the equipment row.');
numberedItem(2, 'The Equipment ID is pre-filled.');
numberedItem(3, 'Enter the Calibration Date (when calibration was performed).');
numberedItem(4, 'Enter the Expiry Date (when calibration next expires).');
numberedItem(5, 'Enter the Certificate Number and Provider name.');
numberedItem(6, 'Upload the certificate PDF file (up to 10 MB).');
numberedItem(7, 'Add any notes and click Save.');
doc.moveDown(0.3);
note('The expiry date must be after the calibration date. The system validates this before saving.');

heading('Viewing Certificates & History', 2);
bullet('Click "View History" to see all past calibration records for an item.');
bullet('Click the certificate link to open or download the PDF certificate.');

// ═══════════════════════════════════════════════
// 12. MAINTENANCE
// ═══════════════════════════════════════════════
doc.addPage();
heading('12. Maintenance');
body('Track scheduled and completed maintenance activities across all equipment.');

heading('Summary Cards', 2);
bullet('Status counts: Scheduled, In Progress, Completed, Cancelled.');
bullet('Overdue: Maintenance tasks past their scheduled date.');
bullet('Due Soon: Tasks coming up in the next 30 days.');
bullet('Cost This Month / Year: Total maintenance spend.');

heading('Viewing Maintenance Records', 2);
body('Two tabs are available:');
bullet('All Maintenance: Full list with advanced filters.');
bullet('Due This Month: Quick view of upcoming work in the next 30 days.');

heading('Filtering', 2);
bullet('Status: Scheduled, In Progress, Completed, Cancelled.');
bullet('Maintenance Type: Filter by type (from pre-defined list).');
bullet('Search: By equipment name or ID.');
bullet('Date Range: Filter by scheduled date window.');

heading('Creating a Maintenance Record', 2);
numberedItem(1, 'Click "Add Maintenance".');
numberedItem(2, 'Select the Equipment from the dropdown.');
numberedItem(3, 'Select a Maintenance Type.');
numberedItem(4, 'Set the Scheduled Date.');
numberedItem(5, 'Optionally set a Completed Date (if already done).');
numberedItem(6, 'Enter who performed the work (internal personnel or external provider).');
numberedItem(7, 'Enter the Cost and Downtime Days.');
numberedItem(8, 'Set the Next Maintenance Date for recurring scheduling.');
numberedItem(9, 'Add a Work Order Number if applicable.');
numberedItem(10, 'Click Save.');

heading('Managing Records', 2);
bullet('Click the edit icon to update a record (e.g. mark as completed, add cost).');
bullet('Click delete to remove a record (confirmation required).');

// ═══════════════════════════════════════════════
// 13. EQUIPMENT ANALYTICS
// ═══════════════════════════════════════════════
doc.addPage();
heading('13. Equipment Analytics');
body('Visual analytics for understanding equipment distribution, usage patterns, and lifecycle data.');

heading('Distribution Tab', 2);
bullet('Equipment by Location: Pie chart showing where equipment is stored.');
bullet('Equipment by Category: Bar chart of category distribution.');
bullet('Status Breakdown: Available vs. Checked Out proportions.');

heading('Usage Stats Tab', 2);
bullet('Monthly Trends: Line chart of checkout/check-in volumes over time.');
bullet('Most-Used Locations: Bar chart ranking locations by movement count.');
bullet('Personnel Patterns: Who checks out equipment most frequently.');

heading('Calibration Tab', 2);
body('Visual breakdown of calibration status across the fleet.');

heading('Maintenance Insights Tab', 2);
body('Charts analysing maintenance costs, frequency, and patterns.');

heading('Equipment Insights Tool', 2);
body('Search for any individual equipment item to see its personal analytics:');
bullet('Complete movement history.');
bullet('User and location usage breakdown.');
bullet('12-month usage trend chart.');
bullet('Total lifetime checkout/check-in counts.');

// ═══════════════════════════════════════════════
// 14. ASSETS DASHBOARD
// ═══════════════════════════════════════════════
doc.addPage();
heading('14. Assets Dashboard');
body('The Assets Dashboard provides a unified overview of all company assets: laptops, cellphones, and vehicles.');

heading('Alert Section', 2);
body('Critical alerts appear at the top:');
bullet('License Disk Expiry (red): Vehicles with expired or soon-to-expire license disks.');
bullet('Service Due (orange): Vehicles approaching or past service intervals.');
bullet('Unpaid Fines (red): Outstanding traffic fines with total amount.');

heading('Asset Summary Cards', 2);
body('Cards showing totals and breakdowns for each asset type:');
bullet('Laptops: Active, in repairs, damaged/stolen/lost counts.');
bullet('Cellphones: Active, in repairs, damaged/stolen/lost counts.');
bullet('Vehicles: Available, in use, in service counts.');

heading('Fines Summary', 2);
body('Shows the total count and total Rand value of unpaid vehicle fines.');

heading('Quick Navigation', 2);
body('Each section has a direct link to the detailed management page (Laptop Assignments, Cellphone Assignments, Vehicles).');

// ═══════════════════════════════════════════════
// 15. ASSET ANALYTICS
// ═══════════════════════════════════════════════
checkPageSpace(200);
heading('15. Asset Analytics');
body('Advanced analytics across all IT and vehicle assets. Uses four tabs:');

heading('Overview Tab', 2);
bullet('Asset distribution pie chart.');
bullet('Total and active assets by type.');
bullet('Device costs and recurring monthly/annual costs.');

heading('Laptops Tab', 2);
bullet('Status distribution, brand distribution charts.');
bullet('Upgrade status: Due (red), Approaching (orange), OK (green) based on 4-year lifecycle.');
bullet('Age distribution and cost breakdown (device cost vs. yearly support).');

heading('Cellphones Tab', 2);
bullet('Status and brand distribution charts.');
bullet('Upgrade status based on 2-year lifecycle.');
bullet('Monthly cost analysis and age distribution.');

heading('Vehicles Tab', 2);
bullet('Fleet status breakdown.');
bullet('Make/model distribution and mileage analytics.');
bullet('Fine analytics (paid vs. unpaid) and service cost breakdown.');

// ═══════════════════════════════════════════════
// 16. LAPTOP ASSIGNMENTS
// ═══════════════════════════════════════════════
doc.addPage();
heading('16. Laptop Assignments');
body('Track which laptops are assigned to which employees, their lifecycle status, and costs.');

heading('Filtering & Searching', 2);
bullet('Search by employee name, laptop model, or serial number.');
bullet('Status filter: Active, Returned, Stolen, Damaged, In Repairs, Lost, Decommissioned.');
bullet('Division and Brand filters.');
bullet('Date range filter by assignment date.');

heading('Table Columns', 2);
bullet('Employee name and division.');
bullet('Brand, model, and serial number.');
bullet('Device cost and monthly cost.');
bullet('Assignment date and age.');
bullet('Upgrade Status: OK (green, <36 months), Approaching (orange, 36-48 months), Due (red, 48+ months).');
bullet('Status badge.');

heading('Upgrade Lifecycle', 2);
body('Laptops follow a 4-year lifecycle:');
bullet('Under 3 years: OK (green) - no action needed.');
bullet('3 to 4 years: Approaching (orange) - plan for replacement.');
bullet('Over 4 years: Due (red) - should be replaced.');

heading('Actions', 2);
bullet('Add new assignment: Record a laptop issued to an employee.');
bullet('Edit: Update assignment details.');
bullet('Reassign: Transfer the laptop to a different employee.');
bullet('Change Status: Mark as Returned, In Repairs, Stolen, etc.');
bullet('View History: See all changes for this assignment.');
bullet('Bulk Operations: Select multiple rows for bulk status change or reassignment.');
bullet('Import/Export: Import from Excel or export current data.');

// ═══════════════════════════════════════════════
// 17. CELLPHONE ASSIGNMENTS
// ═══════════════════════════════════════════════
doc.addPage();
heading('17. Cellphone Assignments');
body('Track cellphone assignments to employees. Works similarly to Laptop Assignments but with a 2-year lifecycle.');

heading('Key Differences from Laptops', 2);
bullet('Upgrade lifecycle is 2 years instead of 4.');
bullet('OK: Under 18 months (green).');
bullet('Approaching: 18 to 24 months (orange).');
bullet('Due: Over 24 months (red).');

heading('Features', 2);
bullet('Same filtering, searching, and sorting as Laptop Assignments.');
bullet('Division and brand breakdown views.');
bullet('Cost summary cards.');
bullet('Bulk operations (multi-select for status change or reassignment).');
bullet('Import from Excel and Export to Excel.');

// ═══════════════════════════════════════════════
// 18. VEHICLES
// ═══════════════════════════════════════════════
doc.addPage();
heading('18. Vehicles');
body('Comprehensive vehicle fleet management with four tabs.');

heading('Fleet Tab', 2);
body('The main vehicle register:');
bullet('All vehicles with registration, make, model, year, fuel type.');
bullet('Status badges and condition assessments.');
bullet('License disk expiry date and service alerts.');
bullet('Mileage tracking.');
doc.moveDown(0.2);
body('Actions: Add vehicle, edit details, delete, upload vehicle image.');

heading('Checkouts Tab', 2);
body('Vehicle checkout history:');
bullet('Driver, checkout date, destination, return status.');
bullet('Toggle between showing active checkouts only or all history.');
bullet('Links to the Pre-Trip Form for new checkouts.');

heading('Fines Tab', 2);
body('Traffic fine management:');
bullet('Record fines against a vehicle: amount, date, description, location.');
bullet('Mark fines as Paid or Unpaid.');
bullet('Total paid and unpaid fine amounts displayed in summary cards.');

heading('Services Tab', 2);
body('Vehicle service record tracking:');
bullet('Date, service type, service provider, cost.');
bullet('Mileage at time of service.');
bullet('Next service due date and mileage.');

// ═══════════════════════════════════════════════
// 19. VEHICLE PRE-TRIP FORM
// ═══════════════════════════════════════════════
doc.addPage();
heading('19. Vehicle Pre-Trip Form');
body('A structured multi-step inspection form to complete before taking a vehicle out.');

heading('Step 1: Vehicle & Driver', 2);
numberedItem(1, 'Select the Vehicle from the dropdown (shows registration numbers).');
numberedItem(2, 'Driver Name is auto-filled from your operator profile.');
numberedItem(3, 'Driver License Number is looked up from personnel records.');
numberedItem(4, 'Driver License Expiry is auto-filled.');
numberedItem(5, 'Select a Supervisor from the managers list.');
doc.moveDown(0.3);
warning('If your driver\'s license is expired, a red banner warns you. You should not proceed without a valid license.');

heading('Step 2: Pre-Trip Inspection', 2);
body('Complete the 17-point vehicle inspection checklist:');
doc.moveDown(0.2);

const inspectionItems = [
  'Sanitisation of vehicle', 'Bodywork condition', 'Tyres & pressure',
  'Oil & water level', 'Fuel level', 'Cards (First Auto & AA)',
  'Windscreen, wipers & mirrors', 'Lights (front, rear, indicators)',
  'Spare tyre, jack & spanner', 'Brakes', 'Hooter',
  'Warning triangle', 'License disk', 'Fire extinguisher',
  'First aid kit', 'Warning lights on dashboard', 'Wheel chocks',
];
inspectionItems.forEach((item, i) => {
  bullet(`${item}`, 0);
});

doc.moveDown(0.3);
body('Each check can be marked as: Yes / No / Good / Average / Damaged / Missing / Expired / N/A.');
body('If any item is marked as unsatisfactory, a reason field appears for that item.');

checkPageSpace(200);
heading('Additional Trip Details', 2);
bullet('Vehicle condition assessment: Excellent, Good, Average, or Poor.');
bullet('Start odometer reading (number).');
bullet('Checkout date.');
bullet('Destination.');
bullet('Reason for use (from dropdown list).');
bullet('Additional notes.');

heading('Driver Change', 2);
body('If the driver changes mid-trip, tick the "Driver changed during trip" checkbox and enter the new driver\'s name.');

heading('Returning the Vehicle', 2);
body('Use the Return tab to complete the return process:');
numberedItem(1, 'Select the active checkout from the list.');
numberedItem(2, 'Enter the end odometer reading.');
numberedItem(3, 'Assess the vehicle condition on return.');
numberedItem(4, 'Document any damage or issues.');
numberedItem(5, 'Submit the return.');
doc.moveDown(0.3);
note('The system checks that the return odometer reading is equal to or greater than the start reading.');

// ═══════════════════════════════════════════════
// 20. USER MANAGEMENT
// ═══════════════════════════════════════════════
doc.addPage();
heading('20. User Management (Admin Only)');
body('This page is only accessible to users with the Admin role. It manages system user accounts.');

heading('Searching & Filtering', 2);
bullet('Search by username, email, or full name.');
bullet('Filter by role.');
bullet('Filter by active status (Active/Inactive).');

heading('Creating a User', 2);
numberedItem(1, 'Click "Add User".');
numberedItem(2, 'Enter Username and Email.');
numberedItem(3, 'Enter the Full Name.');
numberedItem(4, 'Select a Role: Admin, Manager, Technician, or Viewer.');
numberedItem(5, 'Optionally link to a Personnel record (for operator identification).');
numberedItem(6, 'Set the Active status toggle.');
numberedItem(7, 'Click Save.');

heading('Bulk Import from Personnel', 2);
body('To quickly create user accounts from existing personnel records:');
numberedItem(1, 'Click "Import from Personnel".');
numberedItem(2, 'Select the personnel records you want to create accounts for (multi-select).');
numberedItem(3, 'Choose the role to assign to all selected users.');
numberedItem(4, 'Click Import. Accounts are created for each selected person.');

heading('Managing Users', 2);
bullet('Edit: Update any user details or role.');
bullet('Toggle Active: Enable or disable a user account without deleting it.');
bullet('Delete: Permanently remove a user account (confirmation required).');

// ═══════════════════════════════════════════════
// 21. AUDIT LOG
// ═══════════════════════════════════════════════
doc.addPage();
heading('21. Audit Log');
body('The Audit Log records every change made in the system. It provides full traceability for compliance and troubleshooting.');

heading('Summary Panels (Last 30 Days)', 2);
bullet('Top Tables Modified: Which data tables have the most changes.');
bullet('Top Users by Activity: Who has been most active.');
bullet('Action Breakdown: Count of INSERTs, UPDATEs, and DELETEs.');
bullet('Activity by Day: Line chart showing daily change volume.');

heading('Filtering', 2);
bullet('Table: Filter by which table was modified (Equipment, Movements, Calibration, Reservations, Maintenance, Personnel, Customers, Users).');
bullet('Action: INSERT, UPDATE, or DELETE.');
bullet('Date Range: Set a from and to date.');
bullet('Pagination: Navigate through records, 50 per page.');

heading('Reading Audit Entries', 2);
body('Each row shows:');
bullet('Timestamp: When the change occurred.');
bullet('User: Who made the change.');
bullet('Table: Which data table was affected.');
bullet('Action: INSERT (new record), UPDATE (modified), or DELETE (removed).');
bullet('Record ID: Which specific record changed.');
doc.moveDown(0.2);
body('Click on any entry to expand the detail view:');
bullet('Old Values: Shown in red with strikethrough (what the data was before).');
bullet('New Values: Shown in green (what the data is now).');
bullet('Changed Fields: Highlighted so you can quickly spot what was modified.');

// ═══════════════════════════════════════════════
// 22. SETTINGS
// ═══════════════════════════════════════════════
doc.addPage();
heading('22. Settings');
body('The Settings page lets administrators configure the system. It is organised into tabs.');

heading('Categories Tab', 2);
body('Manage equipment categories (e.g. Vibration, Oil Analysis, Thermography):');
bullet('Add a new category with a name.');
bullet('Toggle whether items in this category can be checked out.');
bullet('Toggle whether items in this category are consumable.');

heading('Subcategories Tab', 2);
body('Create subcategories linked to a parent category for finer organisation of equipment.');

heading('Locations Tab', 2);
body('Manage storage locations:');
bullet('Add locations with a name and description.');
bullet('These locations appear in checkout/check-in dropdowns.');

heading('Personnel Tab', 2);
body('Manage employee records:');
bullet('Add individual personnel: Full name, employee ID, division, department, supervisor, job title.');
bullet('Bulk import personnel from a CSV or Excel file.');
bullet('Personnel records are used throughout the system for operator selection, assignments, and tracking.');

heading('Assets Tab', 2);
body('Configure asset lifecycle settings:');
bullet('Laptop lifecycle length (default 4 years).');
bullet('Cellphone lifecycle length (default 2 years).');

heading('Appearance Tab', 2);
body('Customise the look and feel:');
bullet('Toggle between Light and Dark mode.');
bullet('Theme preference is saved and persists across sessions.');

// ═══════════════════════════════════════════════
// BACK COVER
// ═══════════════════════════════════════════════
doc.addPage();
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.primary);
doc.fontSize(24).fillColor(C.white).font('Helvetica-Bold')
  .text('Need Help?', 55, 250, { align: 'center' });
doc.moveDown(1);
doc.fontSize(12).fillColor('#bfdbfe').font('Helvetica')
  .text('Contact your system administrator or visit:', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(14).fillColor(C.white).font('Helvetica-Bold')
  .text('wckequipment-store.netlify.app', { align: 'center' });
doc.moveDown(3);
doc.fontSize(10).fillColor('#93c5fd').font('Helvetica')
  .text('Wearcheck Reliability Solutions', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(9).fillColor('#bfdbfe')
  .text('Equipment Store v1.0  |  April 2026', { align: 'center' });

// ── Add page numbers to all pages ──
addFooter();

doc.end();

output.on('finish', () => {
  console.log('PDF generated: WCK_Equipment_Store_User_Guide.pdf');
});
