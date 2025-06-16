import { execSync } from 'child_process';
import http from 'http';

// Generic type that can handle any job data structure
type ImportantInfoRow = {
  [key: string]: any;
}

type ImportantInfoRowWithUrl = ImportantInfoRow & { url?: string };

export function showImportantInfoRowsInBrowser(_importantInfoRows: ImportantInfoRow[]): void {
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

  const columnNames = Object.keys(importantInfoRows[0]);

  const getColumns = (row: ImportantInfoRowWithUrl) => {
    const columns = Object.entries(row).map(([key, value]) => {
      if (key === 'url') {
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
          // Capitalize the source name
          content = typeof content === 'string' ? content.charAt(0).toUpperCase() + content.slice(1) : content;
        } else if (key === 'summary') {
          className = 'summary';
          // Create expandable summary if too long
          if (typeof content === 'string' && content.length > 200) {
            const shortSummary = content.substring(0, 200);
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
        } else if (key === 'adjustedScore' || key === 'baseRating') {
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
    });

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
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { 
            border-collapse: collapse; 
            width: 100%; 
            margin-top: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          th { 
            background-color: #f4f4f4; 
            padding: 12px 8px; 
            text-align: left; 
            font-weight: bold;
            border: 1px solid #ddd;
            cursor: pointer;
            user-select: none;
            position: relative;
          }
          th:hover {
            background-color: #e8e8e8;
          }
          th.sortable::after {
            content: ' ↕';
            font-size: 0.8em;
            color: #999;
          }
          th.sort-asc::after {
            content: ' ↑';
            color: #0066cc;
          }
          th.sort-desc::after {
            content: ' ↓';
            color: #0066cc;
          }
          td { 
            padding: 8px; 
            border: 1px solid #ddd; 
            vertical-align: top;
            max-width: 200px;
            word-wrap: break-word;
          }
          tr:nth-child(even) { background-color: #f9f9f9; }
          tr:hover { background-color: #f0f8ff; }
          a { color: #0066cc; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .summary { max-width: 300px; font-size: 0.9em; }
          .summary-container {
            line-height: 1.4;
          }
          .summary-toggle {
            background: #e3f2fd;
            border: 1px solid #2196f3;
            color: #1976d2;
            padding: 2px 6px;
            font-size: 0.75em;
            border-radius: 3px;
            cursor: pointer;
            margin-top: 4px;
            transition: background-color 0.2s;
          }
          .summary-toggle:hover {
            background: #bbdefb;
          }
          .skills { font-size: 0.85em; color: #666; }
          .company { font-weight: bold; color: #333; }
          .location { color: #666; font-size: 0.9em; }
          .source { 
            font-weight: bold; 
            color: #9b59b6; 
            text-align: center;
            font-size: 0.9em;
          }
          .score {
            font-weight: bold;
            color: #27ae60;
            text-align: center;
            font-size: 1.1em;
          }          .formula {
            font-size: 0.8em;
            color: #7f8c8d;
            font-family: monospace;
            max-width: 300px;
            word-wrap: break-word;
            white-space: normal;
            line-height: 1.3;
          }
          .applicants {
            font-weight: bold;
            color: #e67e22;
            text-align: center;
            font-size: 0.9em;
          }
          .filter-controls {
            margin: 20px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
          }
          .filter-controls input, .filter-controls select {
            margin: 5px;
            padding: 5px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
          }
          .filter-controls label {
            margin-right: 10px;
            font-weight: bold;
          }
        </style>        <script>
          let sortColumn = -1;
          let sortDirection = 'asc';

          // Initialize table with default sort (by adjusted score descending if available)
          document.addEventListener('DOMContentLoaded', function() {
            const table = document.querySelector('table');
            const headers = table.querySelectorAll('th');

            // Look for "Adjusted Score" column and sort by it initially
            for (let i = 0; i < headers.length; i++) {
              const headerText = headers[i].textContent.toLowerCase();
              if (headerText.includes('adjusted') && headerText.includes('score')) {
                sortColumn = i;
                sortDirection = 'desc'; // Start with highest scores first
                sortTable(i);
                break;
              }
            }
          });

          function sortTable(columnIndex) {
            const table = document.querySelector('table');
            const tbody = table.tBodies[0];
            const rows = Array.from(tbody.rows);
            const headers = table.querySelectorAll('th');
            
            // Clear previous sort indicators
            headers.forEach(h => {
              h.classList.remove('sort-asc', 'sort-desc');
              h.classList.add('sortable');
            });
            
            // Toggle sort direction if clicking same column
            if (sortColumn === columnIndex) {
              sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
              sortDirection = 'asc';
            }
            sortColumn = columnIndex;
            
            // Add sort indicator to current column
            headers[columnIndex].classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
              // Sort rows
            rows.sort((a, b) => {
              let aVal = a.cells[columnIndex].textContent.trim();
              let bVal = b.cells[columnIndex].textContent.trim();
              
              // Check if this looks like a date column by examining the header
              const headers = table.querySelectorAll('th');
              const columnHeader = headers[columnIndex]?.textContent.toLowerCase() || '';
              const isDateColumn = columnHeader.includes('posted') || columnHeader.includes('date');

              if (isDateColumn) {
                // Handle date sorting specifically
                // Convert "Unknown", "N/A", etc. to a very old date for sorting
                const parseDate = (dateStr) => {
                  if (!dateStr || dateStr === 'Unknown' || dateStr === 'N/A' || dateStr === '') {
                    return new Date('1900-01-01'); // Very old date for sorting purposes
                  }
                  const date = new Date(dateStr);
                  // If invalid date, also treat as very old
                  return isNaN(date.getTime()) ? new Date('1900-01-01') : date;
                };

                const aDate = parseDate(aVal);
                const bDate = parseDate(bVal);

                return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
              }

              // Handle numeric values (years of experience, scores)
              const aNum = parseFloat(aVal);
              const bNum = parseFloat(bVal);
              if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
              }

              // Handle text (case insensitive)
              aVal = aVal.toLowerCase();
              bVal = bVal.toLowerCase();
              if (sortDirection === 'asc') {
                return aVal.localeCompare(bVal);
              } else {
                return bVal.localeCompare(aVal);
              }
            });
            
            // Re-append sorted rows
            rows.forEach(row => tbody.appendChild(row));
          }

          function filterTable() {
            const titleFilter = document.getElementById('titleFilter').value.toLowerCase();
            const companyFilter = document.getElementById('companyFilter').value.toLowerCase();
            const locationFilter = document.getElementById('locationFilter').value.toLowerCase();
            const sourceFilter = document.getElementById('sourceFilter').value.toLowerCase();
            const seniorityFilter = document.getElementById('seniorityFilter').value.toLowerCase();
            const workModelFilter = document.getElementById('workModelFilter').value.toLowerCase();
            
            const table = document.querySelector('table');
            const rows = table.tBodies[0].rows;
            
            for (let i = 0; i < rows.length; i++) {
              const cells = rows[i].cells;
              const title = (cells[0]?.textContent || '').toLowerCase();
              const company = (cells[1]?.textContent || '').toLowerCase();
              const location = (cells[2]?.textContent || '').toLowerCase();
              
              // Find source, seniority, and work model columns (positions may vary)
              let source = '', seniority = '', workModel = '';
              for (let j = 0; j < cells.length; j++) {
                const cellText = (cells[j]?.textContent || '').toLowerCase();
                const header = document.querySelectorAll('th')[j]?.textContent.toLowerCase() || '';
                
                if (header.includes('source')) source = cellText;
                if (header.includes('seniority')) seniority = cellText;
                if (header.includes('work') && header.includes('model')) workModel = cellText;
              }
              
              const show = title.includes(titleFilter) &&
                          company.includes(companyFilter) &&
                          location.includes(locationFilter) &&
                          (sourceFilter === '' || source.includes(sourceFilter)) &&
                          (seniorityFilter === '' || seniority.includes(seniorityFilter)) &&
                          (workModelFilter === '' || workModel.includes(workModelFilter));
              
              rows[i].style.display = show ? '' : 'none';
            }
          }          function clearFilters() {
            document.getElementById('titleFilter').value = '';
            document.getElementById('companyFilter').value = '';
            document.getElementById('locationFilter').value = '';
            document.getElementById('sourceFilter').value = '';
            document.getElementById('seniorityFilter').value = '';
            document.getElementById('workModelFilter').value = '';
            filterTable();
          }

          function toggleSummary(summaryId) {
            const shortElement = document.getElementById(summaryId + '-short');
            const fullElement = document.getElementById(summaryId + '-full');
            const button = document.getElementById(summaryId + '-btn');

            if (fullElement.style.display === 'none') {
              // Show full summary
              shortElement.style.display = 'none';
              fullElement.style.display = 'inline';
              button.textContent = 'Show less';
            } else {
              // Show short summary
              shortElement.style.display = 'inline';
              fullElement.style.display = 'none';
              button.textContent = 'Show more';
            }
          }
        </script>
      </head>
      <body>
        <h1>Rated Jobs Summary - ${importantInfoRows.length} matching jobs</h1>
        
        <div class="filter-controls">
          <h3>Filters & Search</h3>
          <div>
            <label>Title:</label>
            <input type="text" id="titleFilter" placeholder="Filter by job title..." onkeyup="filterTable()">
            
            <label>Company:</label>
            <input type="text" id="companyFilter" placeholder="Filter by company..." onkeyup="filterTable()">
            
            <label>Location:</label>
            <input type="text" id="locationFilter" placeholder="Filter by location..." onkeyup="filterTable()">
            
            <label>Source:</label>
            <select id="sourceFilter" onchange="filterTable()">
              <option value="">All Sources</option>
              <option value="linkedin">LinkedIn</option>
              <option value="jobindex">JobIndex</option>
            </select>
          </div>
          <div style="margin-top: 10px;">
            <label>Seniority:</label>
            <select id="seniorityFilter" onchange="filterTable()">
              <option value="">All Levels</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
            
            <label>Work Model:</label>
            <select id="workModelFilter" onchange="filterTable()">
              <option value="">All Models</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="on-site">On-site</option>
            </select>
            
            <button onclick="clearFilters()" style="margin-left: 20px; padding: 5px 10px;">Clear Filters</button>
          </div>          <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
            💡 Click column headers to sort • Use filters to narrow down results • Jobs sorted by adjusted score (skill match × recency)<br>
            📊 Scoring: Skills matched get points, multiplied by time decay (1.0 for ≤1d, 0.9 for 2d, 0.8 for 3d, etc.). Jobs with unknown posting dates get a 0.3 multiplier.
          </p>
        </div>
        
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
