"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const global_1 = require("./global");
const configuration_1 = require("./configuration");
const fs_1 = require("./fs");
class File {
    constructor(fid, name, type, extension, size, createdDate, isPublic, ownerUid) {
        this.fid = fid;
        this.name = name;
        this.type = type;
        this.extension = extension;
        this.size = size;
        this.createdDate = createdDate;
        this.ownerUid = ownerUid;
        this._isPublic = isPublic;
    }
    static generateFileId() {
        return global_1.generateRandomString(File.FILE_ID_LENGTH, File.FILE_ID_CHARACTERS);
    }
    get downloadableName() {
        return this.name.endsWith(this.extension) ? this.name : (this.name + '.' + this.extension);
    }
    get isPublic() {
        return this._isPublic;
    }
    set isPublic(newValue) {
        if (this._isPublic === newValue)
            return;
        this._isPublic = newValue;
        database_1.INSTANCE._updateFileInfo(this.fid, {
            isPublic: newValue ? '1' : '0',
        }).then(r => r);
    }
    async deleteMe() {
        await database_1.INSTANCE._deleteFileInfo(this.fid);
        const user = await database_1.INSTANCE.getUser(this.ownerUid);
        if (user)
            user._notifyFileDeleted(this.fid, this.size);
        try {
            await fs_1.deleteFile(configuration_1.UPLOADS_FOLDER + '/' + this.fid);
        }
        catch (e) {
            console.error(`Unable to unlink file (${this.fid}) ${e.message}`);
        }
    }
}
exports.File = File;
File.FILE_ID_CHARACTERS = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890'.split('');
File.FILE_ID_LENGTH = 4;
