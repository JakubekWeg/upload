import { Express } from 'express'
import { INSTANCE as db } from './database'
import { withUser, handleFileUpload } from './global'
import { File } from './file'
import { UPLOADS_FOLDER } from './configuration'


export function init(app: Express) {

	const DEFAULT_SORTING_OPTION = 'upload-asc'
	const FILES_SORTING_METHODS: { [key: string]: any[] } = {
		'name-asc': [(o1: File, o2: File) => o1.name > o2.name ? 1 : -1, 'Sort by name A-Z'],
		'name-desc': [(o1: File, o2: File) => o1.name < o2.name ? 1 : -1, 'Sort by name Z-A'],
		'upload-asc': [(o1: File, o2: File) => o2.createdDate - o1.createdDate, 'Sort by upload time, newest first'],
		'upload-desc': [(o1: File, o2: File) => o1.createdDate - o2.createdDate, 'Sort by upload time, oldest first'],
		'size-desc': [(o1: File, o2: File) => o2.size - o1.size, 'Sort by size bigger first'],
		'size-asc': [(o1: File, o2: File) => o1.size - o2.size, 'Sort by size smaller first'],
	}

	app.get('/files', (req, res) => withUser(req, res, async (user) => {
		const files = await Promise.all(user.filesList.map(e => db.getFileInfo(e) ))

		let sortingMethod: any = FILES_SORTING_METHODS[req.query.sort]
		if (!sortingMethod) {
			sortingMethod = FILES_SORTING_METHODS[DEFAULT_SORTING_OPTION]
			req.query.sort = DEFAULT_SORTING_OPTION
		}
		files.sort(sortingMethod[0])
		res.render('files-list', {
			pageTitle: 'List of your files',
			userName: user.uid,
			files: files,
			usedBytes: user.usedBytes,
			quota: user.quota,
			sorting: FILES_SORTING_METHODS,
			selectedSorting: req.query.sort,
		})
	}))


	const SUPPORTED_INLINE_PREVIEWS = ['text', 'image', 'video', 'audio']

	app.get('/files/:fileId/:action?', async (req, res, next) => {
		if (req.params.action && !['view', 'download', 'delete'].includes(req.params.action)) return next()

		const fileId = req.params.fileId
		const file = await db.getFileInfo(fileId)

		const fileAccessErrorCallback = () => {
			res.status(404).render('error', {
				pageTitle: 'Error 404: File not found',
				errorText: 'Coudn\'t find requested file. It might have been deleted, never existed or you just don\'t have permission to view it.',
				emoji: '😶',
			})
		}


		if (file) {
			const fileAccessSuccessCallback = (isOwner: boolean) => {
				try {
					switch (req.params.action) {
						case 'download':
							res.set('Content-Disposition', 'attachment;filename=' + encodeURIComponent(file.downloadableName))
							res.type(file.type)
							res.sendFile(file.fid, {root: UPLOADS_FOLDER}, (e) => {
								if (e) fileAccessErrorCallback()
							})
							break
						case 'view':
							res.set('Content-Disposition', 'inline;filename=' + encodeURIComponent(file.downloadableName))
							res.type(file.type)
							res.sendFile(file.fid, {root: UPLOADS_FOLDER}, (e) => {
								if (e) fileAccessErrorCallback()
							})
							break
						case 'delete':
							if (isOwner)
								res.render('file-deleting', {
									pageTitle: 'Delete file?',
									name: file.name,
									fid: file.fid,
									size: file.size,
								})
							else
								res.status(403).render('error', {
									errorText: 'You don\'t own this file',
								})
							break

						default:
							const showPreview = SUPPORTED_INLINE_PREVIEWS.includes(file.type.split('/')[0])
							res.render('file-viewer', {
								pageTitle: 'File viewer',
								fid: file.fid,
								name: file.name,
								type: file.type,
								isPublic: file.isPublic,
								isOwner: isOwner,
								showPreview: showPreview,
								createdDate: new Date(file.createdDate).toLocaleString('pl-PL'),
							})
							break
					}
				} catch (e) {
					fileAccessErrorCallback()
				}
			}

			withUser(req, res, (user) => {
				const isOwner = file.ownerUid === user.uid
				if (file.isPublic || isOwner)
					fileAccessSuccessCallback(isOwner)
				else
					fileAccessErrorCallback()
			}, () => {
				if (file.isPublic)
					fileAccessSuccessCallback(false)
				else
					fileAccessErrorCallback()
			})

		} else fileAccessErrorCallback()
	})


	app.get('/files/:fileId/change/visibility/:value', (req, res) => withUser(req, res, async (user) => {
		const file = await db.getFileInfo(req.params.fileId)
		if (!file || user.uid !== file.ownerUid) return res.status(403).render('error', {
			pageTitle: 'Error 403: Forbidden',
			errorText: 'File not found',
		})

		file.isPublic = req.params.value === '1'

		return res.redirect('/files/' + file.fid)
	}))

	app.post('/files/:fileId/delete', (req, res) => withUser(req, res, async (user) => {
		const file = await db.getFileInfo(req.params.fileId)
		if (!file || user.uid !== file.ownerUid) return res.status(404).render('error', {
			pageTitle: 'Error 404: Not found',
			errorText: 'File not found, you might have already deleted it',
		})

		try {
			await file.deleteMe()
			res.redirect('/files')
		} catch (e) {
			console.error(e)
			return res.status(500).render('error', {
				pageTitle: 'Internal server error',
			})
		}
	}))


	/// -------------- upload -----------------

	app.get('/upload', (req, res) => withUser(req, res, (user) => {
		res.render('upload', {
			pageTitle: 'Uploads new file',
			availableBytes: Math.max(user.quota - user.usedBytes, 0),
		})
	}))

	app.post('/upload', (req, res) => withUser(req, res, (user) => {
		handleFileUpload(req, res, user,
			(file) => {
				res.set('File-Id', file.fid)
				res.render('file-uploaded', {
					pageTitle: 'File uploaded',
					filename: file.name,
					size: file.size,
					fileId: file.fid,
				})
			})
	}))
}
