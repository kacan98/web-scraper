import { execSync } from 'child_process';
import http from 'http';

// Generic type that can handle any job data structure
type ImportantInfoRow = {
  [key: string]: any;
}

type ImportantInfoRowWithUrl = ImportantInfoRow & { url?: string };

type Profile = {
  experience: number;
  startDate: string;
  allSkills: { skill: string; rating: number; }[];
  workModelPreferences: string;
  experienceRange: string;
  unknownSkillPenalty: string;
  optionalSkillBonus: string;
};

export function showImportantInfoRowsInBrowser(_importantInfoRows: ImportantInfoRow[], profile?: Profile): void {
  // Add URL to each row based on the source
  const importantInfoRows: ImportantInfoRowWithUrl[] = _importantInfoRows.map((row) => {
    let url = '';

    // Handle different sources
    if (row.originalUrl) {
      url = row.originalUrl;
    } else if (row.linkedinId) {
      url = `https://www.linkedin.com/jobs/search/?currentJobId=${row.linkedinId}`;
    } else if (row.externalId && row.source === 'linkedin') {
      url = `https://www.linkedin.com/jobs/search/?currentJobId=${row.externalId}`;
    } else if (row.source === 'jobindex') {
      // JobIndex URLs might be in originalUrl or we create a search URL
      url = row.originalUrl || `https://www.jobindex.dk/jobsoegning?q=${encodeURIComponent(row.title || '')}`;
    }

    return {
      ...row,
      url
    };
  });

  if (importantInfoRows.length === 0) {
    console.log('No jobs found')
    return
  }

  const columnNames = Object.keys(importantInfoRows[0]).filter(key =>
    !['url', 'originalUrl', 'externalId'].includes(key)
  );

  const getColumns = (row: ImportantInfoRowWithUrl) => {
    const columns = Object.entries(row).map(([key, value]) => {
      // Skip URL-related fields and internal fields
      if (['url', 'originalUrl', 'externalId'].includes(key)) {
        return ''
      } else {
        let content = value;
        let className = '';

        if (key === 'title') {
          // Wrap the title in an <a></a>
          content = `<a href="${row.url}" target="_blank">${value}</a>`
        } else if (key === 'company') {
          className = 'company';
        } else if (key === 'location') {
          className = 'location';
        } else if (key === 'source') {
          className = 'source';
          // Capitalize the source name and add data attribute for styling
          const sourceName = typeof content === 'string' ? content.charAt(0).toUpperCase() + content.slice(1) : content;
          content = `<span data-source="${content?.toLowerCase()}">${sourceName}</span>`;
        } else if (key === 'summary') {
          className = 'summary';
          // Create expandable summary - show less by default (100 chars)
          if (typeof content === 'string' && content.length > 100) {
            const shortSummary = content.substring(0, 100);
            const fullSummary = content;
            const summaryId = `summary-${Math.random().toString(36).substr(2, 9)}`;

            content = `
              <div class="summary-container">
                <span id="${summaryId}-short">${shortSummary}...</span>
                <span id="${summaryId}-full" style="display: none;">${fullSummary}</span>
                <br>
                <button class="summary-toggle" onclick="toggleSummary('${summaryId}')" id="${summaryId}-btn">Show more</button>
              </div>
            `;
          }
        } else if (key === 'requiredSkills' || key === 'optionalSkills') {
          className = 'skills';
        } else if (key === 'numberOfApplicants') {
          className = 'applicants';
          // Format the number of applicants nicely
          if (typeof content === 'number' && content > 0) {
            if (content >= 1000) {
              content = (content / 1000).toFixed(1) + 'k+';
            } else {
              content = content + '+';
            }
          } else if (!content) {
            content = 'N/A';
          }
        } else if (key === 'posted' || key === 'scraped') {
          // Format the date if it's a valid date
          if (content && content !== 'Unknown' && typeof content === 'string') {
            try {
              const date = new Date(content);
              if (!isNaN(date.getTime())) {
                // Check if this is the Unix epoch (1970-01-01) which indicates missing data
                if (date.getFullYear() === 1970 && date.getMonth() === 0 && date.getDate() === 1) {
                  content = 'Unknown';
                } else {
                  content = date.toLocaleDateString();
                }
              }
            } catch (e) {
              // Keep original content if date parsing fails
            }
          }
        } else if (key === 'skills') {
          className = 'skills';
          // Make skills more readable by formatting the content
          if (typeof content === 'string') {
            content = content
              .replace(/Required:/g, '<strong>Required:</strong>')
              .replace(/Optional:/g, '<strong>Optional:</strong>')
              .replace(/\|/g, '<br>');
          }
        } else if (key === 'score' || key === 'baseRating') {
          className = 'score';
          // Format scores nicely
          if (typeof content === 'number') {
            content = content.toFixed(1);
          }
        } else if (key === 'scoringFormula') {
          className = 'formula';
          // Don't truncate the formula - let it display fully
          // The CSS will handle wrapping if needed
        }

        const classAttr = className ? ` class="${className}"` : '';
        return `<td${classAttr}>${content || 'N/A'}</td>`;
      }
    }).filter(column => column !== ''); // Remove empty columns

    return columns.join('');
  }

  const rowsHtml = importantInfoRows
    .map((row) => {
      return `
        <tr>
          ${getColumns(row)}
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Jobs Report - Karel</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
            background: #fafafa;
            color: #1d1d1f;
            line-height: 1.47059;
            font-weight: 400;
            letter-spacing: -0.022em;
          }

          .container {
            max-width: 100%;
            margin: 0 auto;
            padding: 32px;
          }

          .header {
            background: linear-gradient(135deg, #1d1d1f 0%, #424245 100%);
            color: #f5f5f7;
            padding: 48px 40px;
            border-radius: 18px;
            text-align: center;
            margin-bottom: 32px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
          }

          h1 {
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: 12px;
            letter-spacing: -0.025em;
          }

          .job-count {
            opacity: 0.8;
            font-size: 1.1rem;
            font-weight: 400;
          }

          .karel-profile {
            background: #ffffff;
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 32px;
            border: 1px solid #d2d2d7;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
          }

          .karel-profile h3 {
            margin-bottom: 24px;
            font-size: 1.5rem;
            font-weight: 600;
            color: #1d1d1f;
          }

          .profile-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
          }

          .profile-item {
            background: #f5f5f7;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #007aff;
            transition: all 0.3s ease;
          }

          .profile-item:hover {
            background: #f0f0f2;
            transform: translateY(-1px);
          }

          .profile-item h4 {
            color: #007aff;
            margin-bottom: 8px;
            font-size: 1rem;
            font-weight: 600;
          }

          .highlight {
            background: rgba(0, 122, 255, 0.1);
            color: #007aff;
            padding: 4px 8px;
            border-radius: 6px;
            font-weight: 600;
          }

          .skills-section { margin-top: 24px; }
          .skills-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .show-skills-btn {
            background: #007aff;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
          }

          .show-skills-btn:hover {
            background: #0056cc;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
          }

          .skills-modal {
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
            z-index: 1000;
          }

          .skills-modal-content {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 20px;
            padding: 32px;
            max-width: 640px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 24px;
          }

          .close-modal {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #8e8e93;
            transition: color 0.2s ease;
          }

          .close-modal:hover {
            color: #1d1d1f;
          }

          .filters {
            background: #ffffff;
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 32px;
            border: 1px solid #d2d2d7;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
          }

          .filter-row {
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
            align-items: end;
          }

          .filter-group {
            flex: 1;
            min-width: 220px;
          }

          .filter-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #1d1d1f;
            font-size: 14px;
          }

          .filter-group input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #d2d2d7;
            border-radius: 10px;
            font-size: 16px;
            transition: all 0.2s ease;
            background: #ffffff;
          }

          .filter-group input:focus {
            outline: none;
            border-color: #007aff;
            box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
          }

          .checkbox-group {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
          }

          .checkbox-group label {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 0;
            font-weight: 400;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 8px;
            transition: background 0.2s ease;
          }

          .checkbox-group label:hover {
            background: #f5f5f7;
          }

          .checkbox-group input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: #007aff;
          }

          .clear-filters {
            background: #8e8e93;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
          }

          .clear-filters:hover {
            background: #6d6d70;
            transform: translateY(-1px);
          }

          .table-container {
            background: #ffffff;
            border-radius: 16px;
            border: 1px solid #d2d2d7;
            overflow-x: auto;
            max-width: 100%;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
          }

          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1000px;
          }

          th {
            background: #f5f5f7;
            padding: 16px 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid #d2d2d7;
            cursor: pointer;
            white-space: nowrap;
            color: #1d1d1f;
            font-size: 14px;
            transition: background 0.2s ease;
          }

          th:hover {
            background: #f0f0f2;
          }

          th.sortable::after {
            content: ' ↕';
            opacity: 0.4;
            font-size: 12px;
          }

          th.sort-asc::after {
            content: ' ↑';
            color: #007aff;
            opacity: 1;
          }

          th.sort-desc::after {
            content: ' ↓';
            color: #007aff;
            opacity: 1;
          }

          td {
            padding: 16px 12px;
            border-bottom: 1px solid #f2f2f7;
            vertical-align: top;
            font-size: 14px;
          }

          tr:hover {
            background: rgba(0, 122, 255, 0.03);
          }

          a {
            color: #007aff;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;
          }

          a:hover {
            color: #0056cc;
            text-decoration: underline;
          }

          .summary { max-width: 280px; }
          .summary-toggle {
            background: #007aff;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 14px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            margin-top: 8px;
            transition: all 0.2s ease;
          }

          .summary-toggle:hover {
            background: #0056cc;
            transform: translateY(-1px);
          }

          .source {
            padding: 6px 12px;
            border-radius: 16px;
            color: white;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .source[data-source="linkedin"] { background: #0077b5; }
          .source[data-source="jobindex"] { background: #ff6b35; }
          .source:not([data-source]) { background: #8e8e93; }

          .score {
            font-weight: 700;
            color: #30d158;
            text-align: center;
            background: rgba(48, 209, 88, 0.1);
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid rgba(48, 209, 88, 0.2);
          }

          .formula {
            font-size: 11px;
            color: #8e8e93;
            font-family: 'SF Mono', Monaco, Consolas, monospace;
            max-width: 280px;
            background: #f5f5f7;
            padding: 8px;
            border-radius: 6px;
            line-height: 1.4;
          }

          .skills-table {
            width: 100%;
            border-collapse: collapse;
          }

          .skills-table th {
            background: #f5f5f7;
            padding: 12px;
            font-weight: 600;
            color: #1d1d1f;
          }

          .skills-table td {
            padding: 12px;
            border-bottom: 1px solid #f2f2f7;
          }

          .skill-rating {
            text-align: center;
            font-family: 'SF Mono', Monaco, Consolas, monospace;
            font-weight: 600;
          }

          .skill-rating.positive { color: #30d158; }
          .skill-rating.negative { color: #ff3b30; }

          .skill-category {
            text-align: center;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          }

          .skill-category.expert { background: rgba(255, 59, 48, 0.1); color: #ff3b30; }
          .skill-category.proficient { background: rgba(0, 122, 255, 0.1); color: #007aff; }
          .skill-category.familiar { background: rgba(48, 209, 88, 0.1); color: #30d158; }
          .skill-category.penalty { background: rgba(255, 59, 48, 0.1); color: #ff3b30; }

          .help-text {
            margin-top: 32px;
            padding: 24px;
            background: rgba(0, 122, 255, 0.05);
            border-radius: 12px;
            font-size: 14px;
            color: #1d1d1f;
            border: 1px solid rgba(0, 122, 255, 0.1);
          }

          @media (max-width: 768px) {
            .container { padding: 16px; }
            .header { padding: 32px 24px; }
            h1 { font-size: 2rem; }
            .karel-profile { padding: 24px; }
            .filters { padding: 24px; }
            .profile-grid { grid-template-columns: 1fr; }
            .filter-row { flex-direction: column; align-items: stretch; }
            .filter-group { min-width: auto; }
            th, td { padding: 12px 8px; font-size: 13px; }
            .skills-modal-content { margin: 16px; padding: 24px; }
          }
        </style>        <script>
          let sortColumn = -1;
          let sortDirection = 'asc';

          // Initialize table with default sort
          document.addEventListener('DOMContentLoaded', function() {
            const table = document.querySelector('.table-container table');
            if (!table) return;

            const headers = table.querySelectorAll('th');

            // Look for "Score" column and mark it as sorted descending initially
            for (let i = 0; i < headers.length; i++) {
              const headerText = headers[i].textContent.toLowerCase();
              if (headerText.includes('score')) {
                sortColumn = i;
                sortDirection = 'desc';

                headers.forEach(h => {
                  h.classList.remove('sort-asc', 'sort-desc');
                  h.classList.add('sortable');
                });
                headers[i].classList.add('sort-desc');
                break;
              }
            }
          });

          function sortTable(columnIndex) {
            const table = document.querySelector('.table-container table');
            if (!table) return;

            const tbody = table.tBodies[0];
            const rows = Array.from(tbody.rows);
            const headers = table.querySelectorAll('th');
            
            // Clear previous sort indicators
            headers.forEach(h => {
              h.classList.remove('sort-asc', 'sort-desc');
              h.classList.add('sortable');
            });
            
            // Toggle sort direction
            if (sortColumn === columnIndex) {
              sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
              const headerText = headers[columnIndex]?.textContent.toLowerCase() || '';
              sortDirection = headerText.includes('score') ? 'desc' : 'asc';
            }
            sortColumn = columnIndex;

            headers[columnIndex].classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');

            // Sort rows
            rows.sort((a, b) => {
              let aVal = a.cells[columnIndex].textContent.trim();
              let bVal = b.cells[columnIndex].textContent.trim();

              const headers = table.querySelectorAll('th');
              const columnHeader = headers[columnIndex]?.textContent.toLowerCase() || '';
              const isDateColumn = columnHeader.includes('posted') || columnHeader.includes('date');

              if (isDateColumn) {
                const parseDate = (dateStr) => {
                  if (!dateStr || dateStr === 'Unknown' || dateStr === 'N/A' || dateStr === '') {
                    return new Date('1900-01-01');
                  }
                  const date = new Date(dateStr);
                  return isNaN(date.getTime()) ? new Date('1900-01-01') : date;
                };

                const aDate = parseDate(aVal);
                const bDate = parseDate(bVal);
                return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
              }

              // Handle numeric values
              const aNum = parseFloat(aVal);
              const bNum = parseFloat(bVal);
              if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
              }

              // Handle text
              aVal = aVal.toLowerCase();
              bVal = bVal.toLowerCase();
              return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            });

            rows.forEach(row => tbody.appendChild(row));
          }

          function filterTable() {
            const titleFilter = document.getElementById('titleFilter').value.toLowerCase();
            const hybridChecked = document.getElementById('hybridFilter').checked;
            const onsiteChecked = document.getElementById('onsiteFilter').checked;
            const remoteChecked = document.getElementById('remoteFilter').checked;

            const table = document.querySelector('.table-container table');
            if (!table) return;

            const rows = table.tBodies[0].rows;
            
            for (let i = 0; i < rows.length; i++) {
              const cells = rows[i].cells;
              const title = (cells[0]?.textContent || '').toLowerCase();
              
              // Find work model column
              let workModel = '';
              for (let j = 0; j < cells.length; j++) {
                const cellText = (cells[j]?.textContent || '').toLowerCase();
                const header = document.querySelectorAll('th')[j]?.textContent.toLowerCase() || '';
                
                if (header.includes('work') && header.includes('model')) {
                  workModel = cellText;
                  break;
                }
              }
              
              // Check if title matches
              const titleMatches = title.includes(titleFilter);

              // Check if work model matches (if any checkboxes are selected)
              let workModelMatches = true;
              if (hybridChecked || onsiteChecked || remoteChecked) {
                workModelMatches = false;
                if (hybridChecked && workModel.includes('hybrid')) workModelMatches = true;
                if (onsiteChecked && workModel.includes('on-site')) workModelMatches = true;
                if (remoteChecked && workModel.includes('remote')) workModelMatches = true;
              }
              
              const show = titleMatches && workModelMatches;
              rows[i].style.display = show ? '' : 'none';
            }
          }

          function clearFilters() {
            document.getElementById('titleFilter').value = '';
            document.getElementById('hybridFilter').checked = false;
            document.getElementById('onsiteFilter').checked = false;
            document.getElementById('remoteFilter').checked = false;
            filterTable();
          }

          function toggleSummary(summaryId) {
            const shortElement = document.getElementById(summaryId + '-short');
            const fullElement = document.getElementById(summaryId + '-full');
            const button = document.getElementById(summaryId + '-btn');

            if (fullElement.style.display === 'none') {
              shortElement.style.display = 'none';
              fullElement.style.display = 'inline';
              button.textContent = 'Show less';
            } else {
              shortElement.style.display = 'inline';
              fullElement.style.display = 'none';
              button.textContent = 'Show more';
            }
          }

          function showSkillsModal() {
            document.getElementById('skillsModal').style.display = 'block';
          }

          function hideSkillsModal() {
            document.getElementById('skillsModal').style.display = 'none';
          }

          // Close modal when clicking outside
          window.onclick = function(event) {
            const modal = document.getElementById('skillsModal');
            if (event.target === modal) {
              hideSkillsModal();
            }
          }
        </script>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 Rated Jobs Summary</h1>
            <div class="job-count">${importantInfoRows.length} matching jobs found</div>
          </div>
        
          ${profile ? `
          <div class="karel-profile">
            <h3>👨‍💻 Karel's Profile & Scoring System</h3>
            <div class="profile-grid">
              <div class="profile-item">
                <h4>🎓 Experience</h4>
                <div class="content">
                  <span class="highlight">${profile.experience} years</span> of programming experience<br>
                  <small style="color: #64748b;">Started: ${profile.startDate}</small>
                </div>
              </div>
              
              <div class="profile-item">
                <h4>🏢 Work Model Preferences</h4>
                <div class="content">${profile.workModelPreferences}</div>
              </div>
              
              <div class="profile-item">
                <h4>📊 Experience Scoring</h4>
                <div class="content">${profile.experienceRange}</div>
              </div>
              
              <div class="profile-item">
                <h4>❓ Unknown Skills</h4>
                <div class="content">${profile.unknownSkillPenalty}</div>
              </div>
              
              <div class="profile-item">
                <h4>� Optional Skills</h4>
                <div class="content">${profile.optionalSkillBonus}</div>
              </div>
            </div>
            
            <div class="skills-section">
              <div class="skills-header">
                <h4>⭐ Skills & Ratings (${profile.allSkills.length} total)</h4>
                <button class="show-skills-btn" onclick="showSkillsModal()">View All Skills</button>
              </div>
            </div>
          </div>
          ` : ''}
          
          <div class="filters">
            <h3>🔍 Filters & Search</h3>
            <div class="filter-row">
              <div class="filter-group">
                <label for="titleFilter">Job Title</label>
                <input type="text" id="titleFilter" placeholder="Search by title..." onkeyup="filterTable()">
              </div>
              
              <div class="filter-group">
                <label>Work Model</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" id="hybridFilter" onchange="filterTable()"> Hybrid</label>
                  <label><input type="checkbox" id="onsiteFilter" onchange="filterTable()"> On-site</label>
                  <label><input type="checkbox" id="remoteFilter" onchange="filterTable()"> Remote</label>
                </div>
              </div>
              
              <button class="clear-filters" onclick="clearFilters()">Clear Filters</button>
            </div>
          </div>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  ${columnNames.filter(name => name !== 'url').map((name, index) => {
                    const displayName = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return `<th class="sortable" onclick="sortTable(${index})">${displayName}</th>`;
                  }).join('')}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="help-text">
            💡 <strong>How to use:</strong> Click column headers to sort • Use filters to find specific jobs<br>
            📊 <strong>Scoring:</strong> Skills matched get points, work model bonus, experience penalties, multiplied by time decay<br>
            ⏰ <strong>Time decay:</strong> 1.0 for ≤1d, 0.9 for 2d, 0.8 for 3d, etc. Unknown dates get 0.3 multiplier
          </div>
        </div>

        <!-- Skills Modal -->
        ${profile ? `
        <div id="skillsModal" class="skills-modal">
          <div class="skills-modal-content">
            <div class="modal-header">
              <h3>All Skills & Ratings</h3>
              <button class="close-modal" onclick="hideSkillsModal()">&times;</button>
            </div>
            <table class="skills-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Rating</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                ${profile.allSkills.map(({ skill, rating }) => {
                  const category = rating > 0 ? (rating >= 20 ? 'Expert' : rating >= 10 ? 'Proficient' : 'Familiar') : 'Penalty';
                  const categoryClass = rating > 0 ? (rating >= 20 ? 'expert' : rating >= 10 ? 'proficient' : 'familiar') : 'penalty';
                  const ratingClass = rating > 0 ? 'positive' : 'negative';
                  return `
                    <tr>
                      <td class="skill-name">${skill}</td>
                      <td class="skill-rating ${ratingClass}">${rating > 0 ? '+' : ''}${rating}</td>
                      <td class="skill-category ${categoryClass}">${category}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}
      </body>
    </html>
  `;

  const server = http.createServer((_req, res) => {
    if (_req.url === 'job-applied') {
      console.log('job-applied')
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  const port = Math.floor(Math.random() * 10000) + 5000; // Random port between 5000-15000
  server.listen(port, () => {
    console.log(`🌐 Jobs report available at: http://localhost:${port}`);
    // Open browser on Windows
    try {
      execSync(`start http://localhost:${port}`);
    } catch (error) {
      console.log('Could not automatically open browser. Please visit the URL above manually.');
    }
  });
}
