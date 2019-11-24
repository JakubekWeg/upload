import { existsSync, readFileSync } from 'fs'

import { DB_CONFIG_FILE, BCRYPT_ROUNDS, UPLOADS_FOLDER } from './configuration'
import { File } from './file'
import { generateRandomString } from './global'
import { User } from './user'
import { MySqlConnection } from './mysql'
import { generateSalt, hashData, compareHashed } from './bcrypt'
import { deleteFile, fileExists, rename } from './fs'


export class Database {
	private static CORRECT_USER_NAME_REGEX = /^[a-z0-9-_.]{3,50}$/

	private USERS: Map<string, User | undefined> = new Map()
	private FILES: Map<string, File | undefined> = new Map()
	// code - uid
	private UPLOAD_CODES: Map<string, string> = new Map()

	private mysqlConnection: MySqlConnection

	constructor() {
		if (INSTANCE) throw new Error()
		INSTANCE = this
	}

	/** This method is called by a framework, don't call it */
	async openDatabaseConnection() {

		if (this.mysqlConnection)
			throw new Error('Database already connected!')
		if (!existsSync(DB_CONFIG_FILE))
			throw new Error('Database configuration file not found!')
		const config = JSON.parse(readFileSync(DB_CONFIG_FILE, {encoding: 'utf8'}))

		this.mysqlConnection = await MySqlConnection.create({
			charset: 'utf8',
			host: config.hostname,
			user: config.username,
			password: config.password,
			database: config.catalog,
		})

		this.UPLOAD_CODES.clear()
		this.USERS.clear()
		this.FILES.clear()

		for (const r of await this.mysqlConnection.query('SELECT name FROM users'))
			this.USERS.set(r.name, undefined)

		for (const r of await this.mysqlConnection.query('SELECT id FROM files'))
			this.FILES.set(r.id, undefined)
	}

	close(): Promise<void> {
		return this.mysqlConnection.close()
	}


	async createUser(name: string, password: string,
	                 quota: number, maxFiles: number): Promise<User> {
		if (!name)
			throw new Error('Missing user name')
		name = name.toLowerCase()
		if (this.USERS.has(name))
			throw new Error('User with this name already exists!')

		if (!Database.CORRECT_USER_NAME_REGEX.test(name))
			throw new Error('User name doesn\'t match requirements!')

		if (!password) throw new Error('Invalid password')

		const salt = await generateSalt(BCRYPT_ROUNDS)
		const hashed = await hashData(password, salt)

		const entity = new User(name, hashed, quota, maxFiles, false, 0, [])
		await this.mysqlConnection
			.query('INSERT INTO users (name, password, quota, maxFiles) VALUES (?,?,?,?)',
				name, hashed, quota, maxFiles)
		this.USERS.set(name, entity)

		return entity
	}

	hasUser(uid: string): boolean {
		return this.USERS.has(uid.toLowerCase())
	}

	async getUser(uid: string | undefined): Promise<User | undefined> {
		if (!uid) return
		uid = uid.toLowerCase()
		if (!this.USERS.has(uid))
			return

		let user = this.USERS.get(uid)
		if (!user) {
			const userInfo = (await this.mysqlConnection
				.query('SELECT password, quota, maxFiles, isAdmin FROM users WHERE name = ?', uid))[0]

			const files = (await this.mysqlConnection
				.query('SELECT id, size FROM files WHERE owner = ?', uid))


			user = new User(uid, userInfo.password,
				userInfo.quota,
				userInfo.maxFiles, userInfo.isAdmin,
				files.reduce((val, file) => val + file.size, 0),
				files.map(e => e.id))

			this.USERS.set(uid, user)
		}
		return user
	}

	async signInUserByPassword(login: string, password: string): Promise<User> {
		if (!!login && !!password) {
			const user = await this.getUser(login)
			if (user && await compareHashed(password, user.password))
				return user
		}
		throw new Error('Invalid login or password!')
	}


	generateUniqueFileId(): string {
		const fid = File.generateFileId()
		return this.FILES.has(fid) ? this.generateUniqueFileId() : fid
	}

	hasFileInfo(fid: string | undefined): boolean {
		return !!fid && this.FILES.has(fid)
	}

	async getFileInfo(fid: string | undefined): Promise<File | undefined> {
		if (!fid || !this.hasFileInfo(fid))
			return

		let file = this.FILES.get(fid)
		if (!file) {
			const {id, name, contentType, size, owner, uploadTime, isPublic, extension} =
				(await this.mysqlConnection
					.query('SELECT id, name, contentType, size, owner, uploadTime, isPublic, extension FROM files WHERE id = ?', fid))[0]
			file = new File(id, name, contentType, extension, +size,
				new Date(uploadTime).getTime(), isPublic, owner)
			this.FILES.set(fid, file)
		}
		return file
	}

	async createFileInfo(existingFileToRename: string,
	                     fid: string, name: string, contentType: string,
	                     extension: string, size: number, uploadTime: number,
	                     isPublic: boolean, owner: string) {
		if (fid.includes('/'))
			throw new Error()
		owner = owner.toLowerCase()

		const user = await this.getUser(owner)
		if (!user)
			throw new Error('User not found')

		if (this.hasFileInfo(fid))
			throw new Error('File with this id is already registered!')

		await rename(existingFileToRename, UPLOADS_FOLDER + '/' + fid)

		try {
			await this.mysqlConnection.query(
				'INSERT INTO files (id, name, contentType, size, owner, uploadTime, isPublic, extension) VALUES (?,?,?,?,?,from_unixtime(? / 1000),?,?)',
				fid, name, contentType, size, owner, uploadTime, isPublic, extension)

			const entity = new File(fid, name, contentType, extension, size, uploadTime, isPublic, owner)
			this.FILES.set(fid, entity)
			user._notifyFileCreated(fid, size)
			return entity
		} catch (e) {
			try {
				await deleteFile(UPLOADS_FOLDER + '/' + fid)
			} catch (e) {
				// ignore
			}
			throw e
		}
	}

	/** This method is called by a framework, don't call it */
	_createNewUploadCode(uid: string): string {
		const code = generateRandomString(User.UPLOAD_CODE_LENGTH, User.UPLOAD_CODE_ALLOWED_CHARACTERS)
		if (this.UPLOAD_CODES.has(code))
			return this._createNewUploadCode(uid)
		this.UPLOAD_CODES.set(code, uid)
		return code
	}

	getUidByUploadCode(code: string): string | undefined {
		return this.UPLOAD_CODES.get(code)
	}

	/** This method is called by a framework, don't call it */
	_forgetUploadCode(code: string | undefined) {
		if (code)
			this.UPLOAD_CODES.delete(code)
	}

	/** This method is called by a framework, don't call it */
	async _updateFileInfo(fid: string, values: any) {
		values = Object.entries(values)
		await this.mysqlConnection.query('UPDATE files SET '
			+ values.map((e: any) => e[0] + ' = ?')
			+ ' WHERE id = ?',
			...values.map((e: any) => e[1]), fid)
	}


	/** This method is called by a framework, don't call it */
	async _updateUserInfo(uid: string, values: any) {
		values = Object.entries(values)
		await this.mysqlConnection.query('UPDATE users SET '
			+ values.map((e: any) => e[0] + ' = ?')
			+ ' WHERE name = ?',
			...values.map((e: any) => e[1]), uid)
	}

	/** This method is called by a framework, don't call it
	 *  Use file.deleteMe() instead */
	async _deleteFileInfo(fid: string): Promise<void> {
		if (!this.hasFileInfo(fid))
			return

		await this.mysqlConnection.query('DELETE FROM files WHERE id = ?', fid)
		this.FILES.delete(fid)
	}

}


export function initDatabase(): Promise<void> {
	if (!INSTANCE) {
		INSTANCE = new Database()
		return INSTANCE.openDatabaseConnection()
	}
	return Promise.reject('Database already initialized')
}

export let INSTANCE: Database
