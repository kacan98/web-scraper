import http from 'http';
import { execSync } from 'child_process';
import { jobAiAnalysisTable, linkedInJobPostsTable } from 'db/schema/linkedin/linkedin-schema';

type NullablePartial<T> = {
    [K in keyof T]?: T[K] | null;
};

type ImportantInfoRow = NullablePartial<(typeof jobAiAnalysisTable.$inferSelect & typeof linkedInJobPostsTable.$inferSelect)> & { url: string }

export function showImportantInfoRowsInBrowser(importantInfoRows: ImportantInfoRow[]): void {
    const columnNames = Object.keys(importantInfoRows[0]);
    const rowsHtml = importantInfoRows
        .map((row) => {
            return `
        <tr>
          ${Object.entries(row).map(([key, value]) => {
                if (key === 'url') {
                    return ''
                } else {
                    if (key === 'title') {
                        //wrap the title in an <a></a>
                        value = `<a href="${row.url}">${value}</a>`
                    }
                }
                return `<td>${value}</td>`;
            }).join('')}
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
                if(name === 'url') return ''

                return `<th>${name}</th>`;
            }).join('')}
          </tr>
          ${rowsHtml}
        </table>
      </body>
    </html>
  `;

    const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    });

    const port = 3000;
    server.listen(port, () => {
        // Open browser on Windows
        execSync(`start http://localhost:${port}`);
    });
}