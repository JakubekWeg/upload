import { INSTANCE as db } from './database'
import { generateRandomString } from './global'
import { UPLOADS_FOLDER } from './configuration'
import { deleteFile } from './fs'

export class File {
	private static FILE_ID_CHARACTERS = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890'.split('')
	private static FILE_ID_LENGTH = 4

	public static generateFileId(): string {
		return generateRandomString(File.FILE_ID_LENGTH, File.FILE_ID_CHARACTERS)
	}


	public get downloadableName(): string {
		return this.name.endsWith(this.extension) ? this.name : (this.name + '.' + this.extension)
	}

	private _isPublic: boolean
	public get isPublic(): boolean {
		return this._isPublic
	}

	public set isPublic(newValue: boolean) {
		if (this._isPublic === newValue) return
		this._isPublic = newValue
		db._updateFileInfo(this.fid, {
			isPublic: newValue ? '1' : '0',
		}).then(r => r)
	}

	constructor(
		public readonly fid: string,
		public readonly name: string,
		public readonly type: string,
		public readonly extension: string,
		public readonly size: number,
		public readonly createdDate: number,
		isPublic: boolean,
		public readonly ownerUid: string) {
		this._isPublic = isPublic
	}

	public async deleteMe() {
		await db._deleteFileInfo(this.fid)
		const user = await db.getUser(this.ownerUid)
		if (user)
			user._notifyFileDeleted(this.fid, this.size)
		try {
			await deleteFile(UPLOADS_FOLDER + '/' + this.fid)
		} catch (e) {
			console.error(`Unable to unlink file (${this.fid}) ${e.message}`)
		}
	}
}
