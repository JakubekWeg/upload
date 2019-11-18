import { File } from "./file";
import { generateRandomString } from "./global";
import { INSTANCE as db } from "./database";
import { EXPIRE_UPLOAD_CODE_AFTER } from "./configuration";

export class User {
    private static UPLOAD_CODE_ALLOWED_CHARACTERS: string[] = "0123456789".split('')
    public static UPLOAD_CODE_LENGTH: number = 4

    static generateUploadCode(): string {
        return generateRandomString(User.UPLOAD_CODE_LENGTH, User.UPLOAD_CODE_ALLOWED_CHARACTERS)
    }

    private files: Map<string, File> = new Map()
    private activeSessions: string[] = []

    private _usedBytes: number = 0;
    public get usedBytes(): number {
        return this._usedBytes
    }

    public get filesList(): File[] {
        return Array.from(this.files.values())
    }

    public fileById(fileId: string): File | undefined {
        return this.files.get(fileId)
    }


    private _currentUploadCode: string | undefined;
    private _currentUploadCodeExpires: number = 0;
    public get currentUploadCode(): string | undefined {
        if (this._currentUploadCode) {
            if (this._currentUploadCodeExpires > new Date().getTime())
                return this._currentUploadCode;
            db.unregisterUploadCode(this._currentUploadCode)
        }

        this._currentUploadCode = db.registerNewUploadCode(this.uid)
        this._currentUploadCodeExpires = new Date().getTime() + EXPIRE_UPLOAD_CODE_AFTER
        return this._currentUploadCode
    }

    public get currentCodeExpresAfter(): number {
        this.currentUploadCode
        return this._currentUploadCodeExpires - new Date().getTime();
    }

    public onUploadCodeUsed() {
        if (this._currentUploadCode)
            db.unregisterUploadCode(this._currentUploadCode)
        this._currentUploadCodeExpires = 0
    }



    constructor(
        public uid: string,
        public password: string,
        public quota: number,
        files: any) {
        for (const fileId in files) {
            const f = files[fileId]
            this.files.set(fileId,
                new File(fileId,
                    f.name,
                    f.type,
                    f.extension,
                    f.size,
                    f.createdDate,
                    !!f.isPublic,
                    this
                ))
            this._usedBytes += f.size
        }
    }

    toJson(): any {
        const obj = {
            password: this.password,
            quota: +this.quota,
            files: {}
        }
        this.files.forEach((f, fid) => Object.assign(obj.files, { [fid]: f.toJson() }))
        return obj
    }


    hasSessionActive(sid: string): boolean {
        return this.activeSessions.includes(sid)
    }

    addActiveSession(sid: string) {
        this.activeSessions.push(sid)
    }
    destroyActiveSession(sid: string) {
        const index = this.activeSessions.indexOf(sid)
        if (index >= 0)
            this.activeSessions.splice(index, 1)
    }


    registerFile(file: File) {
        if (this.files.has(file.fid)) throw new Error('User already has this file')
        this.files.set(file.fid, file)
        this._usedBytes += file.size
    }

    unregisterFile(file: File) {
        this.files.delete(file.fid)
        this._usedBytes -= file.size
    }
}