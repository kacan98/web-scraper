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
  const columnNames = Object.keys(importantInfoRows[0]);
  const getColumns = (row: ImportantInfoRowWithUrl) => {
    const columns = Object.entries(row).map(([key, value]) => {
      if (key === 'url') {
        return ''
      } else {
        if (key === 'title') {
          //wrap the title in an <a></a>
          value = `<a href="${row.url}">${value}</a>`
        }
      }
      return `<td>${value}</td>`;
    });

    //maybe one day
    // //add one more columns with a checkbox that marks if I've applied to the job or not
    // columns.push(`<td><input type="checkbox" name="job-applied" value="${row.url}" /></td>`);

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
      <head><meta charset="utf-8" /></head>
      <body>
        <h1>Jobs summary</h1>
        <table border="1" cellspacing="0" cellpadding="5">
          <tr>
            ${columnNames.map((name) => {
              if (name === 'url') return ''

              return `<th>${name}</th>`;
            }).join('')}
          </tr>
          ${rowsHtml}
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

  const port = 5555;
  server.listen(port, () => {
    // Open browser on Windows
    execSync(`start http://localhost:${port}`);
  });
}