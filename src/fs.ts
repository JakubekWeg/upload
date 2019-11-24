import * as native from 'fs'

export function deleteFile(path: native.PathLike): Promise<void> {
	return new Promise<void>((resolve, reject) =>
		native.unlink(path, (err => {
			if (err) reject(err)
			else resolve()
		})))
}

export function rename(oldPath: native.PathLike, newPath: native.PathLike): Promise<void> {
	return new Promise<void>((resolve, reject) =>
		native.rename(oldPath, newPath, (err => {
			if (err) reject(err)
			else resolve()
		})))
}


export function fileExists(path: native.PathLike): Promise<boolean> {
	return new Promise<boolean>((resolve, reject) =>
		native.stat(path, ((err, result) => {
			if (err) reject(err)
			else resolve(result.isFile())
		})))
}
