import { existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
// -------------- CONFIG HERE: -------------------------
// decides if this server is running in production mode
export const PRODUCTION: boolean = process.env.NODE_ENV === "production";
console.log({ PRODUCTION, env: process.env.NODE_ENV });

// folder where uploaded files are saved
export const UPLOADS_FOLDER: string = "./uploads";

// folder where temporary files gets stored when upload happens
// it must be on the same partition as UPLOADS_FOLDER
export const TMP_UPLOADS_FOLDER: string =
  UPLOADS_FOLDER + "/" + "./.tmp.uploads";

// max size of uploaded file in bytes, if file is greater then error 500 will be sent
export const FILE_MAX_SIZE: number = 4 * 1024 * 1024 * 1024; //4GB

// port of the http server
export const HTTP_SERVER_PORT: number = 8123;

// max age header value (in millis)
export const STATIC_ASSETS_MAX_AGE: number = PRODUCTION
  ? 1 * 24 * 60 * 60 * 1000
  : 5 * 1000;

// milliseconds after upload token expires, it always expires when used
export const EXPIRE_UPLOAD_CODE_AFTER: number = 2 * 60 * 1000;

// number of bcrypt rounds used to hash password (greater = more secure, slower)
export const BCRYPT_ROUNDS: number = 12;

// default root password, should be changed after configuration
export const DEFAULT_ROOT_PASSWORD: string = "root";

// default user's quota in bytes
export const DEFAULT_USER_QUOTA: number = 1024 * 1024 * 64; // 64MB

// default user's files count limit
export const DEFAULT_USER_FILES_LIMIT: number = 16;

// -------------- END OF CONFIG -------------------------
// preparing folders, don't change
function validateConfig() {
  if (!existsSync(UPLOADS_FOLDER)) mkdirSync(UPLOADS_FOLDER);

  if (existsSync(TMP_UPLOADS_FOLDER))
    readdirSync(TMP_UPLOADS_FOLDER).forEach((name) =>
      unlinkSync(TMP_UPLOADS_FOLDER + "/" + name)
    );
  else mkdirSync(TMP_UPLOADS_FOLDER);
}

validateConfig();
