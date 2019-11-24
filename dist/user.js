"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const configuration_1 = require("./configuration");
class User {
    constructor(uid, password, quota, maxFiles, isAdmin, initialUsedBytes, files) {
        this.uid = uid;
        this.files = files;
        this.activeSessions = [];
        this._usedBytes = 0;
        this._uploadCodeExpires = 0;
        this._usedBytes = initialUsedBytes;
        this._password = password;
        this._quota = quota;
        this._isAdmin = isAdmin;
        this._maxFiles = maxFiles;
    }
    get usedBytes() {
        return this._usedBytes;
    }
    get availableBytes() {
        return this.quota - this.usedBytes;
    }
    get password() {
        return this._password;
    }
    set password(newHashedPassword) {
        if (this._password === newHashedPassword)
            return;
        this._password = newHashedPassword;
        database_1.INSTANCE._updateUserInfo(this.uid, { password: newHashedPassword }).then(r => r);
    }
    get quota() {
        return this._quota;
    }
    set quota(newValue) {
        if (this._quota === newValue)
            return;
        this._quota = newValue;
        database_1.INSTANCE._updateUserInfo(this.uid, { quota: newValue }).then(r => r);
    }
    get maxFiles() {
        return this._maxFiles;
    }
    set maxFiles(newValue) {
        if (this._maxFiles === newValue)
            return;
        this._maxFiles = newValue;
        database_1.INSTANCE._updateUserInfo(this.uid, { maxFiles: newValue }).then(r => r);
    }
    get canUploadOneMoreFile() {
        return this.maxFiles > this.files.length;
    }
    get isAdmin() {
        return this._isAdmin;
    }
    set isAdmin(newValue) {
        if (this._isAdmin === newValue)
            return;
        this._isAdmin = newValue;
        database_1.INSTANCE._updateUserInfo(this.uid, { isAdmin: newValue }).then(r => r);
    }
    hasSessionActive(sid) {
        return this.activeSessions.includes(sid);
    }
    addActiveSession(sid) {
        this.activeSessions.push(sid);
    }
    destroyActiveSession(sid) {
        const index = this.activeSessions.indexOf(sid);
        if (index >= 0)
            this.activeSessions.splice(index, 1);
    }
    get filesList() {
        return this.files.slice(0);
    }
    get currentUploadCode() {
        if (new Date().getTime() > this._uploadCodeExpires || !this._uploadCode) {
            database_1.INSTANCE._forgetUploadCode(this._uploadCode);
            this._uploadCode = database_1.INSTANCE._createNewUploadCode(this.uid);
            this._uploadCodeExpires = new Date().getTime() + configuration_1.EXPIRE_UPLOAD_CODE_AFTER;
        }
        return this._uploadCode;
    }
    get uploadCodeExpiresIn() {
        return Math.max(this._uploadCodeExpires - new Date().getTime(), 0);
    }
    makeUploadCodeExpired() {
        this._uploadCodeExpires = 0;
        this._uploadCode = undefined;
        database_1.INSTANCE._forgetUploadCode(this._uploadCode);
    }
    /** This method is called by a framework, don't call it */
    _notifyFileCreated(fid, size) {
        this.files.push(fid);
        this._usedBytes += size;
    }
    /** This method is called by a framework, don't call it
     *  Use file.deleteMe() instead */
    _notifyFileDeleted(fid, size) {
        const index = this.files.indexOf(fid);
        if (index >= 0)
            this.files.splice(index, 1);
        this._usedBytes -= size;
    }
}
exports.User = User;
User.UPLOAD_CODE_ALLOWED_CHARACTERS = '0123456789'.split('');
User.UPLOAD_CODE_LENGTH = 4;
