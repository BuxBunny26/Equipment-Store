// Shared division lookup utilities
// Used by Reports, CellphoneAssignments, LaptopAssignments, and Vehicles pages

export const DIVISION_ABBREVS = {
  'rs': 'RS',
  'afs': 'AFS',
  'gp': 'GP Consult',
  'gp consult': 'GP Consult',
  'wearcheck': 'RS'
};

export function standardiseDivision(div) {
  if (!div) return '';
  if (div === 'GP') return 'GP Consult';
  return div;
}

export function buildDivisionLookup(personnel) {
  const byName = {};
  const byId = {};
  (personnel || []).forEach(p => {
    if (p.full_name) byName[p.full_name.toLowerCase()] = p.division || '';
    if (p.employee_id) byId[p.employee_id.toLowerCase()] = p.division || '';
  });
  return { byName, byId, personnel: personnel || [] };
}

// Levenshtein edit distance – handles typos like Thlou/Tlou, Sergent/Sergant
export function editDist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const m = a.length, n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return dp[m][n];
}

/**
 * Look up the division for an item by matching its name field against personnel.
 * @param {Object} lookup   - result from buildDivisionLookup()
 * @param {Object} item     - the record (vehicle / cellphone / laptop / etc.)
 * @param {string} nameField - which property on `item` holds the person's name
 *                             e.g. 'assigned_to', 'employee_name'
 */
export function lookupDivision(lookup, item, nameField) {
  const empName = item[nameField] || '';

  // 1. Exact name match
  if (empName) {
    const d = lookup.byName[empName.toLowerCase()];
    if (d) return standardiseDivision(d);
  }

  // 2. Employee ID match
  if (item.employee_id) {
    const d = lookup.byId[item.employee_id.toLowerCase()];
    if (d) return standardiseDivision(d);
  }

  // 3. Multi-strategy fuzzy name matching
  if (empName) {
    const nameLower = empName.toLowerCase();
    const nameParts = nameLower.split(/\s+/);
    const searchSurname = nameParts[nameParts.length - 1];
    const searchFirst = nameParts[0];

    const match = lookup.personnel.find(p => {
      if (!p.full_name) return false;
      const pName = p.full_name.toLowerCase();
      const pParts = pName.split(/\s+/);
      const pSurname = pParts[pParts.length - 1];

      // Strategy A: All search words found in personnel name
      // Handles "Daniel Molapo" → "Tshegofatsho Daniel Molapo"
      // Uses startsWith for abbreviations like "Jaco" → "Jacobus"
      if (nameParts.length >= 2 && nameParts.every(w =>
        pParts.some(pw => pw === w || (w.length >= 3 && pw.startsWith(w)) || (pw.length >= 3 && w.startsWith(pw)))
      )) return true;

      // Strategy B: Surname match (exact or fuzzy) + first name related
      // Handles "Sergent Thlou" → "Sergant Sakhile Tlou" (edit distance)
      const surnameExact = pSurname === searchSurname;
      const surnameFuzzy = !surnameExact && editDist(pSurname, searchSurname) <= 2;

      if (surnameExact || surnameFuzzy) {
        if (pParts.some(pw =>
          pw === searchFirst ||
          (searchFirst.length >= 3 && pw.startsWith(searchFirst)) ||
          (pw.length >= 3 && searchFirst.startsWith(pw)) ||
          (pw.length >= 3 && searchFirst.length >= 3 && editDist(pw, searchFirst) <= 2)
        )) return true;
      }

      return false;
    });
    if (match?.division) return standardiseDivision(match.division);
  }

  // 4. Fall back to notes field if it contains a known division abbreviation
  if (item.notes) {
    const notesLower = item.notes.toLowerCase().trim();
    if (DIVISION_ABBREVS[notesLower]) return DIVISION_ABBREVS[notesLower];
  }

  return '';
}
