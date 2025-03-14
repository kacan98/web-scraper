// import { ScrapingSource } from "model";
// import { Page, Request, Response } from "playwright";
// import { getSaveInFileFcWithNameOfFile } from "src/local-file-saving";
// import * as fs from "fs";

// interface CapturedRequest {
//   url: string;
//   method: string;
//   postData?: string;
//   headers: Record<string, string>;
//   response?: {
//     status: number;
//     body: string;
//     headers: Record<string, string>;
//   };
// }

// // Helper to check if we should process a URL
// const shouldProcessUrl = (url: string) => {
//   return (
//     url.startsWith("http://") ||
//     (url.startsWith("https://") && !url.includes("chrome-extension://"))
//   );
// };

// const getPlaformSpecificSavingFunctionAndPath = (platform: ScrapingSource) => {
//   const { saveInFileFc: saveCapturedResponses, filePath } =
//     getSaveInFileFcWithNameOfFile(
//       "captured_responses",
//       `responses_${platform}`,
//       "json",
//       false
//     );

//   return {
//     saveCapturedResponses,
//     filePath,
//   };
// };

// export async function captureAndSaveResponses(
//   page: Page,
//   platform: ScrapingSource
// ): Promise<void> {
//   const { saveCapturedResponses } =
//     getPlaformSpecificSavingFunctionAndPath(platform);

//   const capturedRequests: CapturedRequest[] = [];

//   page.on("request", (request: Request) => {
//     const url = request.url();
//     if (!shouldProcessUrl(url)) return;

//     const requestData: CapturedRequest = {
//       url,
//       method: request.method(),
//       postData: request.postData() || undefined,
//       headers: request.headers(),
//     };  

//     capturedRequests.push(requestData);
//     saveCapturedResponses(capturedRequests);
//   });

//   page.on("response", async (response: Response) => {
//     const request = response.request();
//     const url = request.url();

//     if (!shouldProcessUrl(url)) return;

//     try {
//       // Skip redirects and other uncapturable responses
//       if (response.status() >= 300 && response.status() < 400) return;

//       const body = await response.body();
//       const matchingRequest = capturedRequests.find((r) => r.url === url);

//       if (matchingRequest) {
//         matchingRequest.response = {
//           status: response.status(),
//           body: body.toString("utf-8"),
//           headers: response.headers(),
//         };
//       }

//       saveCapturedResponses(capturedRequests);
//     } catch (error) {
//       console.error(`Failed to capture response for ${url}:`, error);
//     }
//   });

// }

// export async function mockResponses(
//   page: Page,
//   platform: ScrapingSource
// ): Promise<void> {
//   const { filePath } = getPlaformSpecificSavingFunctionAndPath(platform);
//   const fileExists = fs.existsSync(filePath);
//   console.log("fileExists", fileExists);
//   const fileContents = fs.readFileSync(filePath, "utf-8");
//   const capturedRequests: CapturedRequest[] = fileExists
//     ? JSON.parse(fileContents)
//     : [];

//   capturedRequests.forEach((r) => {
//     page.route(r.url, async (route, request) => {
//       const url = request.url();

//       // Skip non-HTTP/HTTPS or chrome-extension URLs
//       if (!shouldProcessUrl(url)) {
//         route.continue();
//         return;
//       }

//       try {
//         await route.fetch();
//         route.continue();
//       } catch (error: any) {
//         console.log(
//           `Request to ${url} failed, attempting mock:`,
//           error.message
//         );

//         const matchingCapture = capturedRequests.find(
//           (r) => r.url === url && r.method === request.method()
//         );

//         if (matchingCapture && matchingCapture.response) {
//           route.fulfill({
//             status: matchingCapture.response.status,
//             headers: matchingCapture.response.headers,
//             body: matchingCapture.response.body,
//           });
//         } else {
//           console.log(`No mock available for ${url}`);
//           route.abort();
//         }
//       }
//     });
//   });
// }
