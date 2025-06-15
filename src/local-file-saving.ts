import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { LOGGING_ENABLED } from "./utils";

const getFilenameFriendlyDateTime = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const formatted = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  return formatted;
};

const errors: any[] = [];
const dateAndTime = getFilenameFriendlyDateTime();
const errorFileName = `errors`;
export const errorLog = (...args: any[]) => {
  if (LOGGING_ENABLED) {
    console.error(...args);
  }
  errors.push(args.toString());
  saveInFile("errors", errorFileName, "json", errors);
};

export const getSaveInFileFcWithNameOfFile = (
  pathFromRoot: string,
  fileName: string,
  fileExtension: string,
  addDateToFileName = true
): {
  saveInFileFc: (data: any) => Promise<string>;
  filePath: string;
} => {
  const filePath = getFileNameForFunctionSaveInFile(
    pathFromRoot,
    fileName,
    fileExtension,
    addDateToFileName
  );

  const saveInFileFc = (data: any)=> saveInFile.bind(
    null,
    pathFromRoot,
    fileName,
    fileExtension,
    data,
    addDateToFileName
  )();

  return {
    filePath,
    saveInFileFc,
  };
};

export const saveInFile = async (
  pathFromRoot: string,
  fileName: string,
  fileExtension: string,
  data: any,
  addDateToFileName = true
) => {
  const filePath = getFileNameForFunctionSaveInFile(
    pathFromRoot,
    fileName,
    fileExtension,
    addDateToFileName
  );

  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {
      recursive: true,
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
};

// Handle both runtime and test environments
let currentFileDir: string;
let currentFileName: string;
try {
  // Use dynamic import to avoid TypeScript import.meta issues in test environment
  const importMeta = eval('import.meta') as { url?: string };
  if (importMeta?.url) {
    currentFileName = fileURLToPath(importMeta.url);
    currentFileDir = dirname(currentFileName);
  } else {
    // Fallback for test environment
    currentFileDir = process.cwd();
    currentFileName = __filename;
  }
} catch {
  // Fallback for test environment or when import.meta is not available
  currentFileDir = process.cwd();
  currentFileName = 'local-file-saving.ts';
}
const currentFilenameFriendlyDateTime = getFilenameFriendlyDateTime();
const getFileNameForFunctionSaveInFile = (
  pathFromRoot: string,
  fileName: string,
  fileExtension: string,
  addDateToFileName = true
) => {
  let completeFileName = "";
  if (addDateToFileName) {
    completeFileName += `${currentFilenameFriendlyDateTime}_`;
  }
  completeFileName += fileName;
  completeFileName += `.${fileExtension}`;
  // so this function has to be in a folder that is one folder deep in the root...
  // that's why we need the "../" in the path.resolve
  // It sucks and I hate it but I don't have more patience to deal with this.
  const filePath = path.resolve(
    currentFileDir,
    "../",
    pathFromRoot,
    completeFileName
  );
  return filePath;
};
