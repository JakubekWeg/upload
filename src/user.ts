import { File } from './file'
import { generateRandomString } from './global'
import { INSTANCE as db } from './database'
import { EXPIRE_UPLOAD_CODE_AFTER } from './configuration'

export class User {
	static UPLOAD_CODE_ALLOWED_CHARACTERS: string[] = '0123456789'.split('')
	public static UPLOAD_CODE_LENGTH: number = 4

	private activeSessions: string[] = []

	private _usedBytes: number = 0
	public get usedBytes(): number {
		return this._usedBytes
	}

	public get availableBytes(): number {
		return this.quota - this.usedBytes
	}

	private _password: string
	public get password(): string {
		return this._password
	}

	public set password(newHashedPassword: string) {
		if (this._password === newHashedPassword) return
		this._password = newHashedPassword
		db._updateUserInfo(this.uid, {password: newHashedPassword}).then(r => r)
	}


	private _quota: number
	public get quota(): number {
		return this._quota
	}

	public set quota(newValue: number) {
		if (this._quota === newValue) return
		this._quota = newValue
		db._updateUserInfo(this.uid, {quota: newValue}).then(r => r)
	}

	private _maxFiles: number
	public get maxFiles(): number {
		return this._maxFiles
	}

	public set maxFiles(newValue: number) {
		if (this._maxFiles === newValue) return
		this._maxFiles = newValue
		db._updateUserInfo(this.uid, {maxFiles: newValue}).then(r => r)
	}

	public get canUploadOneMoreFile(): boolean {
		return this.maxFiles > this.files.length
	}

	private _isAdmin: boolean
	public get isAdmin(): boolean {
		return this._isAdmin
	}

	public set isAdmin(newValue: boolean) {
		if (this._isAdmin === newValue) return
		this._isAdmin = newValue
		db._updateUserInfo(this.uid, {isAdmin: newValue}).then(r => r)
	}

	constructor(
		public readonly uid: string,
		password: string,
		quota: number,
		maxFiles: number,
		isAdmin: boolean,
		initialUsedBytes: number,
		private files: string[]) {
		this._usedBytes = initialUsedBytes
		this._password = password
		this._quota = quota
		this._isAdmin = isAdmin
		this._maxFiles = maxFiles
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

	public get filesList(): string[] {
		return this.files.slice(0)
	}


	private _uploadCode: string | undefined
	private _uploadCodeExpires: number = 0
	public get currentUploadCode(): string {
		if (new Date().getTime() > this._uploadCodeExpires || !this._uploadCode) {
			db._forgetUploadCode(this._uploadCode)
			this._uploadCode = db._createNewUploadCode(this.uid)
			this._uploadCodeExpires = new Date().getTime() + EXPIRE_UPLOAD_CODE_AFTER
		}
		return this._uploadCode
	}

	public get uploadCodeExpiresIn(): number {
		return Math.max(this._uploadCodeExpires - new Date().getTime(), 0)
	}

	public makeUploadCodeExpired() {
		this._uploadCodeExpires = 0
		this._uploadCode = undefined
		db._forgetUploadCode(this._uploadCode)
	}




	/** This method is called by a framework, don't call it */
	public _notifyFileCreated(fid: string, size: number) {
		this.files.push(fid)
		this._usedBytes += size
	}


	/** This method is called by a framework, don't call it
	 *  Use file.deleteMe() instead */
	public _notifyFileDeleted(fid: string, size: number) {
		const index = this.files.indexOf(fid)
		if (index >= 0)
			this.files.splice(index, 1)

		this._usedBytes -= size
	}
}
