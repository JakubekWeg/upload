import * as express from 'express'
import { Request, Response } from 'express'
import { urlencoded as bodyParserUrlEncoded } from 'body-parser'
import * as hbs from "express-handlebars";
import { INSTANCE as db, initDatabase } from "./database";
import * as session from "express-session";
import { withUser } from "./global";
import { HTTP_SERVER_PORT, PRODUCTION, TMP_UPLOADS_FOLDER, UPLOADS_FOLDER, STATIC_ASSETS_MAX_AGE } from "./configuration";
import { init as initFilesRoutes } from './files-route';
import { init as initTokenRoutes } from "./token-route";

initDatabase('./db.json')
db.save()

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
        path: '/'
    },
}))


app.use(bodyParserUrlEncoded({
    extended: true
}))

const FILE_SIZES_POSTFIXES = ['', 'K', 'M', 'G', 'T']

app.set('views', './views')
app.set('view engine', 'hbs')
app.engine('hbs', hbs({
    defaultLayout: 'main.hbs',
    extname: '.hbs',
    partialsDir: './views/partials',
    helpers: {
        size: function (size: number): string {
            let index = 0
            size = +size;
            while (size > 1024) {
                index += 1
                size /= 1024
            }
            return `${Math.round(size * 10) / 10}${FILE_SIZES_POSTFIXES[index]}B`
        },
        areEqual: function (arg1: any, arg2: any, options: any) {
            return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
        }
    },
}))

app.listen(HTTP_SERVER_PORT, () => console.log(`Server started at port ${HTTP_SERVER_PORT}!`))

app.get('/style.css', (_req, res) => res.sendFile('style.css', { root: './static', maxAge: STATIC_ASSETS_MAX_AGE }))
app.get('/font.ttf', (_req, res) => res.sendFile('font.ttf', { root: './static', maxAge: STATIC_ASSETS_MAX_AGE }))
app.get('/img/:name', (req, res) => res.sendFile(req.params.name, { root: './static/img', maxAge: STATIC_ASSETS_MAX_AGE }))


app.get('/', (req, res) => withUser(req, res,
    () => res.redirect('/files')))

initFilesRoutes(app)
initTokenRoutes(app)

app.get('/login', (_req, res) => res.redirect('/'))
app.post('/login', (req, res) => withUser(req, res,
    () => res.redirect('/'), () => {

        try {
            const user = db.signInUser(req.body.login, req.body.password)
            if (req.session) {
                req.session.userId = user.uid
                user.addActiveSession(req.session.id)
            }
            res.redirect('/')
        } catch (e) {
            res.status(401).render('error', {
                pageTitle: "Unable to sign you in",
                errorText: e.message,
                emoji: '🤐'
            })
        }
    }))

app.get('/logout', (req, res) => {
    if (req.session) {
        const sid = req.session.id
        const uid = req.session.userId
        req.session.destroy(() => {
            const user = db.getUserByName(uid)
            if (user)
                user.destroyActiveSession(sid)
            res.redirect('/')
        })
    }
})


app.post('/createUser', (req, res) => {
    if (PRODUCTION) {
        res.status(403).send('Run server in admin mode to use this action')
        return
    }
    try {
        db.createUser(req.body.name, req.body.password, req.body.quota)
        res.sendStatus(200)
    } catch (e) {
        res.status(400).send(e.message)
    }
})





app.get('*', (_req: Request, res: Response) => res.status(404).render('error', {
    pageTitle: 'Error 404: Site not found',
    errorText: 'This page wasn\'t found on the server, u sure u typed right link?',
    emoji: '😕',
}))