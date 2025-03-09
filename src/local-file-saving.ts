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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const currentFilenameFriendlyDateTime = getFilenameFriendlyDateTime();
export const saveInFile = async (
  pathFromRoot: string,
  fileName: string,
  fileExtension: string,
  data: any,
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
  // I don't know how to make it more resilient.
  // It sucks and I hate it but I don't have more patience to deal with this.
  const filePath = path.resolve(
    __dirname,
    "../",
    pathFromRoot,
    completeFileName
  );
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {
      recursive: true,
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};
