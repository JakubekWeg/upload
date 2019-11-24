"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const global_1 = require("./global");
const user_1 = require("./user");
const database_1 = require("./database");
function init(app) {
    app.get('/token/show', (req, res) => global_1.withUser(req, res, (user) => {
        res.render('token-showing', {
            pageTitle: 'Your upload token:',
            code: user.currentUploadCode,
            expireAfter: user.uploadCodeExpiresIn / 1000 | 0,
        });
    }));
    app.get('/token/renew', (req, res) => global_1.withUser(req, res, (user) => {
        user.makeUploadCodeExpired();
        res.redirect('/token/show');
    }));
    app.get('/token/upload', (_req, res) => {
        res.render('upload', {
            pageTitle: 'Upload file using a token',
            tokenLength: user_1.User.UPLOAD_CODE_LENGTH,
            usingToken: true
        });
    });
    app.post('/token/upload', (req, res) => {
        global_1.handleFileUpload(req, res, (fields) => {
            return database_1.INSTANCE.getUser(database_1.INSTANCE.getUidByUploadCode(fields.token));
        }, () => {
            res.render('file-uploaded', {
                pageTitle: 'Your file has been uploaded'
            });
        });
    });
}
exports.init = init;
