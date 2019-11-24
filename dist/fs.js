"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const native = require("fs");
function deleteFile(path) {
    return new Promise((resolve, reject) => native.unlink(path, (err => {
        if (err)
            reject(err);
        else
            resolve();
    })));
}
exports.deleteFile = deleteFile;
function rename(oldPath, newPath) {
    return new Promise((resolve, reject) => native.rename(oldPath, newPath, (err => {
        if (err)
            reject(err);
        else
            resolve();
    })));
}
exports.rename = rename;
function fileExists(path) {
    return new Promise((resolve, reject) => native.stat(path, ((err, result) => {
        if (err)
            reject(err);
        else
            resolve(result.isFile());
    })));
}
exports.fileExists = fileExists;
