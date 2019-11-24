"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
// -------------- CONFIG HERE: -------------------------
// decides if this server is running in production mode
exports.PRODUCTION = process.env.NODE_ENV === 'production';
// folder where uploaded files are saved
exports.UPLOADS_FOLDER = './uploads';
// folder where temporary files gets stored when upload happens
// it must be on the same partition as UPLOADS_FOLDER
exports.TMP_UPLOADS_FOLDER = './.tmp.uploads';
// max size of uploaded file in bytes, if file is greater then error 500 will be sent
exports.FILE_MAX_SIZE = 4 * 1024 * 1024 * 1024; //4GB
// port of the http server
exports.HTTP_SERVER_PORT = 8123;
// max age header value (in millis)
exports.STATIC_ASSETS_MAX_AGE = exports.PRODUCTION ? 1 * 24 * 60 * 60 * 1000 : 5 * 1000;
// milliseconds after upload token expires, it always expires when used
exports.EXPIRE_UPLOAD_CODE_AFTER = 2 * 60 * 1000;
// number of bcrypt rounds used to hash password (greater = more secure, slower)
exports.BCRYPT_ROUNDS = 12;
// default root password, should be changed after configuration
exports.DEFAULT_ROOT_PASSWORD = 'root';
// file which contains database configuration
exports.DB_CONFIG_FILE = './db.config.json';
// -------------- END OF CONFIG -------------------------
// preparing folders, don't change
function validateConfig() {
    if (!fs_1.existsSync(exports.UPLOADS_FOLDER))
        fs_1.mkdirSync(exports.UPLOADS_FOLDER);
    if (fs_1.existsSync(exports.TMP_UPLOADS_FOLDER))
        fs_1.readdirSync(exports.TMP_UPLOADS_FOLDER).forEach(name => fs_1.unlinkSync(exports.TMP_UPLOADS_FOLDER + '/' + name));
    else
        fs_1.mkdirSync(exports.TMP_UPLOADS_FOLDER);
}
validateConfig();
