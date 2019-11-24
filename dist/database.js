"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const configuration_1 = require("./configuration");
const file_1 = require("./file");
const global_1 = require("./global");
const user_1 = require("./user");
const mysql_1 = require("./mysql");
const bcrypt_1 = require("./bcrypt");
const fs_2 = require("./fs");
class Database {
    constructor() {
        this.USERS = new Map();
        this.FILES = new Map();
        // code - uid
        this.UPLOAD_CODES = new Map();
        if (exports.INSTANCE)
            throw new Error();
        exports.INSTANCE = this;
    }
    /** This method is called by a framework, don't call it */
    async openDatabaseConnection() {
        if (this.mysqlConnection)
            throw new Error('Database already connected!');
        if (!fs_1.existsSync(configuration_1.DB_CONFIG_FILE))
            throw new Error('Database configuration file not found!');
        const config = JSON.parse(fs_1.readFileSync(configuration_1.DB_CONFIG_FILE, { encoding: 'utf8' }));
        this.mysqlConnection = await mysql_1.MySqlConnection.create({
            charset: 'utf8',
            host: config.hostname,
            user: config.username,
            password: config.password,
            database: config.catalog,
        });
        this.UPLOAD_CODES.clear();
        this.USERS.clear();
        this.FILES.clear();
        for (const r of await this.mysqlConnection.query('SELECT name FROM users'))
            this.USERS.set(r.name, undefined);
        for (const r of await this.mysqlConnection.query('SELECT id FROM files'))
            this.FILES.set(r.id, undefined);
    }
    close() {
        return this.mysqlConnection.close();
    }
    async createUser(name, password, quota, maxFiles) {
        if (!name)
            throw new Error('Missing user name');
        name = name.trim().toLowerCase();
        if (this.USERS.has(name))
            throw new Error('User with this name already exists!');
        if (!Database.CORRECT_USER_NAME_REGEX.test(name))
            throw new Error('User name doesn\'t match requirements!');
        if (!password)
            throw new Error('Invalid password');
        const salt = await bcrypt_1.generateSalt(configuration_1.BCRYPT_ROUNDS);
        const hashed = await bcrypt_1.hashData(password, salt);
        const entity = new user_1.User(name, hashed, quota, maxFiles, false, 0, []);
        await this.mysqlConnection
            .query('INSERT INTO users (name, password, quota, maxFiles) VALUES (?,?,?,?)', name, hashed, quota, maxFiles);
        this.USERS.set(name, entity);
        return entity;
    }
    hasUser(uid) {
        return this.USERS.has(uid.toLowerCase());
    }
    get allUserIds() {
        return Array.from(this.USERS.keys());
    }
    async getUser(uid) {
        if (!uid)
            return;
        uid = uid.toLowerCase();
        if (!this.USERS.has(uid))
            return;
        let user = this.USERS.get(uid);
        if (!user) {
            const userInfo = (await this.mysqlConnection
                .query('SELECT password, quota, maxFiles, isAdmin FROM users WHERE name = ?', uid))[0];
            const files = (await this.mysqlConnection
                .query('SELECT id, size FROM files WHERE owner = ?', uid));
            user = new user_1.User(uid, userInfo.password, userInfo.quota, userInfo.maxFiles, userInfo.isAdmin, files.reduce((val, file) => val + file.size, 0), files.map(e => e.id));
            this.USERS.set(uid, user);
        }
        return user;
    }
    /** This method is called by a framework, don't call it
     * Use user.deleteMe() instead */
    async _deleteUser(uid) {
        uid = uid.trim().toLowerCase();
        if (!this.USERS.has(uid))
            return;
        await this.mysqlConnection.query('DELETE FROM users WHERE name = ?', uid);
        this.USERS.delete(uid);
    }
    async signInUserByPassword(login, password) {
        if (!!login && !!password) {
            const user = await this.getUser(login);
            if (user && await bcrypt_1.compareHashed(password, user.password))
                return user;
        }
        throw new Error('Invalid login or password!');
    }
    generateUniqueFileId() {
        const fid = file_1.File.generateFileId();
        return this.FILES.has(fid) ? this.generateUniqueFileId() : fid;
    }
    hasFileInfo(fid) {
        return !!fid && this.FILES.has(fid);
    }
    async getFileInfo(fid) {
        if (!fid || !this.hasFileInfo(fid))
            return;
        let file = this.FILES.get(fid);
        if (!file) {
            const { id, name, contentType, size, owner, uploadTime, isPublic, extension } = (await this.mysqlConnection
                .query('SELECT id, name, contentType, size, owner, uploadTime, isPublic, extension FROM files WHERE id = ?', fid))[0];
            file = new file_1.File(id, name, contentType, extension, +size, new Date(uploadTime).getTime(), isPublic, owner);
            this.FILES.set(fid, file);
        }
        return file;
    }
    async createFileInfo(existingFileToRename, fid, name, contentType, extension, size, uploadTime, isPublic, owner) {
        if (fid.includes('/'))
            throw new Error();
        owner = owner.toLowerCase();
        const user = await this.getUser(owner);
        if (!user)
            throw new Error('User not found');
        if (this.hasFileInfo(fid))
            throw new Error('File with this id is already registered!');
        await fs_2.rename(existingFileToRename, configuration_1.UPLOADS_FOLDER + '/' + fid);
        try {
            await this.mysqlConnection.query('INSERT INTO files (id, name, contentType, size, owner, uploadTime, isPublic, extension) VALUES (?,?,?,?,?,from_unixtime(? / 1000),?,?)', fid, name, contentType, size, owner, uploadTime, isPublic, extension);
            const entity = new file_1.File(fid, name, contentType, extension, size, uploadTime, isPublic, owner);
            this.FILES.set(fid, entity);
            user._notifyFileCreated(fid, size);
            return entity;
        }
        catch (e) {
            try {
                await fs_2.deleteFile(configuration_1.UPLOADS_FOLDER + '/' + fid);
            }
            catch (e) {
                // ignore
            }
            throw e;
        }
    }
    /** This method is called by a framework, don't call it */
    _createNewUploadCode(uid) {
        const code = global_1.generateRandomString(user_1.User.UPLOAD_CODE_LENGTH, user_1.User.UPLOAD_CODE_ALLOWED_CHARACTERS);
        if (this.UPLOAD_CODES.has(code))
            return this._createNewUploadCode(uid);
        this.UPLOAD_CODES.set(code, uid);
        return code;
    }
    getUidByUploadCode(code) {
        return this.UPLOAD_CODES.get(code);
    }
    /** This method is called by a framework, don't call it */
    _forgetUploadCode(code) {
        if (code)
            this.UPLOAD_CODES.delete(code);
    }
    /** This method is called by a framework, don't call it */
    async _updateFileInfo(fid, values) {
        values = Object.entries(values);
        await this.mysqlConnection.query('UPDATE files SET '
            + values.map((e) => e[0] + ' = ?')
            + ' WHERE id = ?', ...values.map((e) => e[1]), fid);
    }
    /** This method is called by a framework, don't call it */
    async _updateUserInfo(uid, values) {
        values = Object.entries(values);
        await this.mysqlConnection.query('UPDATE users SET '
            + values.map((e) => e[0] + ' = ?')
            + ' WHERE name = ?', ...values.map((e) => e[1]), uid);
    }
    /** This method is called by a framework, don't call it
     *  Use file.deleteMe() instead */
    async _deleteFileInfo(fid) {
        if (!this.hasFileInfo(fid))
            return;
        await this.mysqlConnection.query('DELETE FROM files WHERE id = ?', fid);
        this.FILES.delete(fid);
    }
}
exports.Database = Database;
Database.CORRECT_USER_NAME_REGEX = /^[a-z0-9-_.]{3,50}$/;
function initDatabase() {
    if (!exports.INSTANCE) {
        exports.INSTANCE = new Database();
        return exports.INSTANCE.openDatabaseConnection();
    }
    return Promise.reject('Database already initialized');
}
exports.initDatabase = initDatabase;
