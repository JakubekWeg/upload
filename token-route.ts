import { Express } from "express";
import { withUser, handleFileUpload } from "./global";
import { User } from "./user";
import { INSTANCE as db } from "./database";

export function init(app: Express) {
    app.get('/token/show', (req, res) => withUser(req, res, (user) => {
        res.render('token-showing', {
            pageTitle: 'Your upload token:',
            code: user.currentUploadCode,
            expreAfter: user.currentCodeExpresAfter / 1000 | 0,
        })
    }))

    app.get('/token/renew', (req, res) => withUser(req, res, (user) => {
        user.onUploadCodeUsed();
        res.redirect('/token/show')
    }))

    app.get('/token/upload', (_req, res) => {
        res.render('upload', {
            pageTitle: 'Upload file using a token',
            tokenLength: User.UPLOAD_CODE_LENGTH,
        })
    })

    app.post('/token/upload', (req, res) => {
        handleFileUpload(req, res, (fields) => {
            const user = db.getUserByUploadCode(fields.token)
            if (user)
                user.onUploadCodeUsed()
            return user
        }, () => {
            res.render('file-uploaded', {
                pageTitle: 'Your file has been uploaded'
            })
        })
    })

}