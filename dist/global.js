"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const body_parser_1 = require("body-parser");
const fs_1 = require("./fs");
const user_1 = require("./user");
const database_1 = require("./database");
const configuration_1 = require("./configuration");
const formidable_1 = require("formidable");
exports.POST_DATA_HANDLER = body_parser_1.urlencoded({
    extended: false,
    limit: '5MB',
});
const renderLoginPage = (res) => {
    res.status(403).render('login', {
        pageTitle: 'Sign in to access drive',
    });
};
exports.withUser = (req, res, then, without = () => renderLoginPage(res)) => {
    if (req.session) {
        database_1.INSTANCE.getUser(req.session.userId).then(user => {
            if (user && user.hasSessionActive(req.session ? req.session.id : ''))
                then(user);
            else
                without();
        });
    }
    else
        without();
};
exports.withAdminUser = (req, res, then) => exports.withUser(req, res, user => {
    if (user.isAdmin)
        then(user);
    else
        res.status(403).render('error', {
            pageTitle: 'Error 403: Forbidden',
            errorText: 'This site can be used only by administrators',
            emoji: '😤',
        });
});
exports.generateRandomString = function (length, characters) {
    return Array.from(new Array(length), () => characters[Math.random() * characters.length | 0])
        .join('');
};
exports.handleFileUpload = function (req, res, user, onSuccess) {
    if (!user)
        return res.status(401).render('error', {
            pageTitle: '401: Unauthorized',
            errorText: 'Server couldn\'t authorize you',
            emoji: '😢',
        });
    // if we have a user, we can pre check if file should be received, this checking may be inexact
    if (user instanceof user_1.User) {
        const contentLength = +(req.header('content-length') || 0);
        if (contentLength > user.availableBytes + 2000)
            return res.status(413).render('error', {
                pageTitle: '413: Payload too large',
                errorText: 'You don\'t have enough free space to upload this file',
                emoji: '😢',
            });
    }
    const form = new formidable_1.IncomingForm();
    form.maxFileSize = configuration_1.FILE_MAX_SIZE;
    form.uploadDir = configuration_1.TMP_UPLOADS_FOLDER;
    form.parse(req, async (err, fields, files) => {
        if (err)
            return res.status(500).render('error', {
                pageTitle: 'Error 500: Internal server error',
                errorText: err.message,
            });
        try {
            if (!files.file)
                return res.status(400).render('error', {
                    pageTitle: 'Error 400: Bad Request',
                    errorText: 'You need to give me a file!',
                });
            if (!(user instanceof user_1.User) && !!user)
                user = await user(fields);
            if (!user)
                return res.status(403).render('error', {
                    pageTitle: '403: Forbidden',
                    errorText: 'Your token was probably expired',
                });
            if (!user.canUploadOneMoreFile) {
                await fs_1.deleteFile(files.file.path);
                return res.status(412).render('error', {
                    pageTitle: '412: Precondition Failed',
                    errorText: 'Reached files limit',
                    emoji: '😢',
                });
            }
            if (files.file.size + user.usedBytes >= user.quota) {
                await fs_1.deleteFile(files.file.path);
                return res.status(413).render('error', {
                    pageTitle: '413: Payload too large',
                    errorText: 'You don\'t have enough free space to upload this file',
                    emoji: '😢',
                });
            }
            const fileId = database_1.INSTANCE.generateUniqueFileId();
            const indexOfDot = files.file.name.lastIndexOf('.');
            const file = await database_1.INSTANCE.createFileInfo(files.file.path, fileId, fields.filename.toString() || files.file.name || 'unnamed', files.file.type.trim().toLowerCase(), indexOfDot > 0 ? files.file.name.substring(indexOfDot + 1) : '', files.file.size, new Date().getTime(), false, user.uid);
            onSuccess(file);
        }
        catch (e) {
            return res.status(500).render('error', {
                pageTitle: 'Error 500: Internal server error',
                errorText: err.message,
            });
        }
    });
};
