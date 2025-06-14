import http from 'http';
import { execSync } from 'child_process';
import { jobAiAnalysisTable, linkedInJobPostsTable } from 'db/schema/linkedin/linkedin-schema';

type NullablePartial<T> = {
  [K in keyof T]?: T[K] | null;
};

type ImportantInfoRow = NullablePartial<(typeof jobAiAnalysisTable.$inferSelect & typeof linkedInJobPostsTable.$inferSelect)>
type ImportantInfoRowWithUrl = ImportantInfoRow & { url: string };
export function showImportantInfoRowsInBrowser(_importantInfoRows: ImportantInfoRow[]): void {
  //add url to each row
  const importantInfoRows: (ImportantInfoRowWithUrl)[] = _importantInfoRows.map((row) => {
    return {
      ...row,
      url: `https://www.linkedin.com/jobs/search/?currentJobId=${row.linkedinId}`
    }
  });
  
  if(importantInfoRows.length === 0) {
    console.log('No jobs found')
    return
  }

  const columnNames = Object.keys(importantInfoRows[0]);  const getColumns = (row: ImportantInfoRowWithUrl) => {
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
        } else if (key === 'summary') {
          className = 'summary';
          // Truncate summary if too long
          if (typeof content === 'string' && content.length > 200) {
            content = content.substring(0, 200) + '...';
          }
        } else if (key === 'requiredSkills' || key === 'optionalSkills') {
          className = 'skills';        } else if (key === 'posted') {
          // Format the date if it's a valid date
          if (content && content !== 'Unknown' && typeof content === 'string') {
            try {
              const date = new Date(content);
              if (!isNaN(date.getTime())) {
                content = date.toLocaleDateString();
              }
            } catch (e) {
              // Keep original content if date parsing fails
            }
          }
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
    .join('');  const html = `
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
          .skills { font-size: 0.85em; color: #666; }
          .company { font-weight: bold; color: #333; }
          .location { color: #666; font-size: 0.9em; }
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
        </style>
        <script>
          let sortColumn = -1;
          let sortDirection = 'asc';

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
              
              // Handle numeric values (years of experience, dates)
              const aNum = parseFloat(aVal);
              const bNum = parseFloat(bVal);
              if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
              }
              
              // Handle dates
              const aDate = new Date(aVal);
              const bDate = new Date(bVal);
              if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
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
            const seniorityFilter = document.getElementById('seniorityFilter').value.toLowerCase();
            const workModelFilter = document.getElementById('workModelFilter').value.toLowerCase();
            
            const table = document.querySelector('table');
            const rows = table.tBodies[0].rows;
            
            for (let i = 0; i < rows.length; i++) {
              const cells = rows[i].cells;
              const title = cells[0].textContent.toLowerCase();
              const company = cells[1].textContent.toLowerCase();
              const location = cells[2].textContent.toLowerCase();
              const seniority = cells[6].textContent.toLowerCase();
              const workModel = cells[8].textContent.toLowerCase();
              
              const show = title.includes(titleFilter) &&
                          company.includes(companyFilter) &&
                          location.includes(locationFilter) &&
                          (seniorityFilter === '' || seniority.includes(seniorityFilter)) &&
                          (workModelFilter === '' || workModel.includes(workModelFilter));
              
              rows[i].style.display = show ? '' : 'none';
            }
          }

          function clearFilters() {
            document.getElementById('titleFilter').value = '';
            document.getElementById('companyFilter').value = '';
            document.getElementById('locationFilter').value = '';
            document.getElementById('seniorityFilter').value = '';
            document.getElementById('workModelFilter').value = '';
            filterTable();
          }
        </script>
      </head>      <body>
        <h1>Jobs Summary - ${importantInfoRows.length} matching jobs</h1>
        
        <div class="filter-controls">
          <h3>Filters & Search</h3>
          <div>
            <label>Title:</label>
            <input type="text" id="titleFilter" placeholder="Filter by job title..." onkeyup="filterTable()">
            
            <label>Company:</label>
            <input type="text" id="companyFilter" placeholder="Filter by company..." onkeyup="filterTable()">
            
            <label>Location:</label>
            <input type="text" id="locationFilter" placeholder="Filter by location..." onkeyup="filterTable()">
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
          </div>
          <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
            💡 Click column headers to sort • Use filters to narrow down results
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
    // Open browser on Windows
    execSync(`start http://localhost:${port}`);
  });
}