"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const native = require("bcryptjs");
function generateSalt(rounds) {
    return new Promise(((resolve, reject) => native.genSalt(rounds, (err, result) => {
        if (err)
            reject(err);
        else
            resolve(result);
    })));
}
exports.generateSalt = generateSalt;
function hashData(data, saltOrRounds) {
    return new Promise(((resolve, reject) => native.hash(data, saltOrRounds, (err, result) => {
        if (err)
            reject(err);
        else
            resolve(result);
    })));
}
exports.hashData = hashData;
function compareHashed(data, encrypted) {
    return new Promise(((resolve, reject) => native.compare(data, encrypted, (err, result) => {
        if (err)
            reject(err);
        else
            resolve(result);
    })));
}
exports.compareHashed = compareHashed;
