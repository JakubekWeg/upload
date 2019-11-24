"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const hbs = require("express-handlebars");
const configuration_1 = require("./configuration");
const database_1 = require("./database");
const session = require("express-session");
const global_1 = require("./global");
const files_route_1 = require("./files-route");
const token_route_1 = require("./token-route");
(async () => {
    try {
        await database_1.initDatabase();
        console.log('Connected with database!');
    }
    catch (e) {
        console.error('Unable to connect to database:', e.message);
        return;
    }
    if (!database_1.INSTANCE.hasUser('root')) {
        console.warn('Creating "root" user with password ' + configuration_1.DEFAULT_ROOT_PASSWORD);
        const root = await database_1.INSTANCE.createUser('root', configuration_1.DEFAULT_ROOT_PASSWORD, 0, 0);
        root.isAdmin = true;
    }
    const app = express();
    app.use(session({
        name: 'sid',
        secret: Array.from(new Array(16), () => (Math.random() * Math.pow(2, 31) | 0).toString(16)).join(''),
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: false,
            path: '/',
        },
    }));
    const FILE_SIZES_POSTFIXES = ['', 'K', 'M', 'G', 'T'];
    app.set('views', './views');
    app.set('view engine', 'hbs');
    app.engine('hbs', hbs({
        defaultLayout: 'main.hbs',
        extname: '.hbs',
        partialsDir: './views/partials',
        helpers: {
            size: function (size) {
                let index = 0;
                size = +size;
                while (size > 1024) {
                    index += 1;
                    size /= 1024;
                }
                return `${Math.round(size * 10) / 10}${FILE_SIZES_POSTFIXES[index]}B`;
            },
            areEqual: function (arg1, arg2, options) {
                return (arg1 == arg2) ? options.fn(this) : options.inverse();
            },
        },
    }));
    app.listen(configuration_1.HTTP_SERVER_PORT, () => console.log(`Server started at port ${configuration_1.HTTP_SERVER_PORT}!`));
    app.get('/style.css', (_req, res) => res.sendFile('style.css', { root: './static', maxAge: configuration_1.STATIC_ASSETS_MAX_AGE }));
    app.get('/font.ttf', (_req, res) => res.sendFile('font.ttf', { root: './static', maxAge: configuration_1.STATIC_ASSETS_MAX_AGE }));
    app.get('/img/:name', (req, res) => res.sendFile(req.params.name, {
        root: './static/img',
        maxAge: configuration_1.STATIC_ASSETS_MAX_AGE,
    }));
    app.get('/', (req, res) => global_1.withUser(req, res, () => res.redirect('/files')));
    files_route_1.init(app);
    token_route_1.init(app);
    app.get('/login', (_req, res) => res.redirect('/'));
    app.post('/login', global_1.POST_DATA_HANDLER, (req, res) => global_1.withUser(req, res, () => res.redirect('/'), async () => {
        try {
            const user = await database_1.INSTANCE.signInUserByPassword(req.body.login, req.body.password);
            if (req.session) {
                req.session.userId = user.uid;
                user.addActiveSession(req.session.id);
            }
            res.redirect('/');
        }
        catch (e) {
            res.status(401).render('error', {
                pageTitle: 'Unable to sign you in',
                errorText: e.message,
                emoji: '🤐',
            });
        }
    }));
    app.get('/logout', (req, res) => {
        if (req.session) {
            const sid = req.session.id;
            const uid = req.session.userId;
            req.session.destroy(async () => {
                const user = await database_1.INSTANCE.getUser(uid);
                if (user)
                    user.destroyActiveSession(sid);
                res.redirect('/');
            });
        }
    });
    app.get('*', (_req, res) => res.status(404).render('error', {
        pageTitle: 'Error 404: Site not found',
        errorText: 'This page wasn\'t found on the server, u sure u typed right link?',
        emoji: '😕',
    }));
    // await db.close()
})();
