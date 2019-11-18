import { User } from "./user";
import { Request, Response } from "express";
import { INSTANCE as db } from "./database";
import { TMP_UPLOADS_FOLDER, UPLOADS_FOLDER } from "./configuration";
import { IncomingForm } from "formidable";
import { unlink, rename } from "fs";
import { File } from "./file";

export type UserCallback = (user: User) => void

const renderLoginPage = (res: Response) => {
    res.status(403).render('login', {
        pageTitle: 'Sign in to access drive'
    })
}

export const withUser = (req: Request, res: Response,
    then: UserCallback,
    without: Function = () => renderLoginPage(res)) => {

    if (req.session) {
        const user = db.getUserByName(req.session.userId)
        if (user && user.hasSessionActive(req.session.id)) {
            return then(user)
        }
    }
    without()
}

export const generateRandomString = function (length: number, characters: string[]): string {
    return Array.from(new Array(length),
        () => characters[Math.random() * characters.length | 0])
        .join('')
}

export type UploadUserObtainer = (fields: any) => User | undefined

export type FileUploadedCallback = (filename: string, size: number, fid: string) => void

export const handleFileUpload = function (req: Request, res: Response,
    userGetter: UploadUserObtainer,
    onSuccess: FileUploadedCallback) {
    const form = new IncomingForm()
    form.uploadDir = TMP_UPLOADS_FOLDER
    form.parse(req, (err, fields, files) => {
        if (err)
            return res.status(500).render('error', {
                pageTitle: 'Error 500: Internal server error',
                errorText: err.message,
            })
        if (!files.file)
            return res.status(400).render('error', {
                pageTitle: 'Error 400: Bad Request',
                errorText: 'You need to give me a file!',
            })

        const user = userGetter(fields)
        if (!user) {
            return res.status(403).render('error', {
                pageTitle: '403: Forbidden',
                errorText: 'Your token was probably expired'
            })
        }


        if (files.file.size + user.usedBytes >= user.quota) {
            unlink(files.file.path, () => { })
            return res.status(413).render('error', {
                pageTitle: '413: Payload too large',
                errorText: 'You don\'t have enough free space to upload this file',
                emoji: '😢',
            })
        }

        const fileId = db.registerNewFile(user.uid)
        rename(files.file.path, UPLOADS_FOLDER + '/' + fileId, (err) => {
            if (err) {
                db.unregisterFile(fileId)
                unlink(files.file.path, () => { })

                return res.status(500).render('error', {
                    pageTitle: 'Error 500: Internal server error',
                    errorText: err.message,
                })
            }

            const indexOfDot = files.file.name.lastIndexOf('.')
            user.registerFile(new File(fileId,
                fields.filename.toString() || files.file.name || 'unnamed',
                files.file.type,
                indexOfDot > 0 ? files.file.name.substring(indexOfDot + 1) : '',
                files.file.size, new Date().getTime(),
                false, user
            ))

            db.save()
            onSuccess(fields.filename.toString(), files.file.size, fileId)
        })
    })
}