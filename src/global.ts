import { urlencoded as bodyParserUrlEncoded } from 'body-parser'
import { deleteFile } from './fs'
import { User } from './user'
import { Request, Response } from 'express'
import { INSTANCE as db } from './database'
import { FILE_MAX_SIZE, TMP_UPLOADS_FOLDER } from './configuration'
import { IncomingForm } from 'formidable'
import { File } from './file'

export const POST_DATA_HANDLER = bodyParserUrlEncoded({
	extended: false,
	limit: '5MB',
})

export type UserCallback = (user: User) => void

const renderLoginPage = (res: Response) => {
	res.status(403).render('login', {
		pageTitle: 'Sign in to access drive',
	})
}

export const withUser = (req: Request, res: Response,
                         then: UserCallback,
                         without: Function = () => renderLoginPage(res)) => {

	if (req.session) {
		db.getUser(req.session.userId).then(user => {
			if (user && user.hasSessionActive(req.session ? req.session.id : ''))
				then(user)
			else
				without()
		})
	} else
		without()
}

export const generateRandomString = function (length: number, characters: string[]): string {
	return Array.from(new Array(length),
		() => characters[Math.random() * characters.length | 0])
		.join('')
}

export type UploadUserObtainer = (fields: any) => Promise<User | undefined>

export type FileUploadedCallback = (file: File) => void


export const handleFileUpload = function (req: Request, res: Response,
                                          user: UploadUserObtainer | User | undefined,
                                          onSuccess: FileUploadedCallback) {

	if (!user) return res.status(401).render('error', {
		pageTitle: '401: Unauthorized',
		errorText: 'Server couldn\'t authorize you',
		emoji: '😢',
	})

	// if we have a user, we can pre check if file should be received, this checking may be inexact
	if (user instanceof User) {
		const contentLength = +(req.header('content-length') || 0)
		if (contentLength > user.availableBytes + 2000)
			return res.status(413).render('error', {
				pageTitle: '413: Payload too large',
				errorText: 'You don\'t have enough free space to upload this file',
				emoji: '😢',
			})
	}

	const form = new IncomingForm()
	form.maxFileSize = FILE_MAX_SIZE
	form.uploadDir = TMP_UPLOADS_FOLDER
	form.parse(req, async (err, fields, files) => {
		if (err)
			return res.status(500).render('error', {
				pageTitle: 'Error 500: Internal server error',
				errorText: err.message,
			})

		try {
			if (!files.file)
				return res.status(400).render('error', {
					pageTitle: 'Error 400: Bad Request',
					errorText: 'You need to give me a file!',
				})

			if (!(user instanceof User) && !!user)
				user = await user(fields)

			if (!user)
				return res.status(403).render('error', {
					pageTitle: '403: Forbidden',
					errorText: 'Your token was probably expired',
				})


			if (files.file.size + user.usedBytes >= user.quota) {
				await deleteFile(files.file.path)

				return res.status(413).render('error', {
					pageTitle: '413: Payload too large',
					errorText: 'You don\'t have enough free space to upload this file',
					emoji: '😢',
				})
			}

			const fileId = db.generateUniqueFileId()

			const indexOfDot = files.file.name.lastIndexOf('.')
			const file = await db.createFileInfo(files.file.path, fileId,
				fields.filename.toString() || files.file.name || 'unnamed',
				files.file.type.trim().toLowerCase(),
				indexOfDot > 0 ? files.file.name.substring(indexOfDot + 1) : '',
				files.file.size, new Date().getTime(),
				false, user.uid)

			onSuccess(file)
		} catch (e) {
			return res.status(500).render('error', {
				pageTitle: 'Error 500: Internal server error',
				errorText: err.message,
			})
		}
	})
}
