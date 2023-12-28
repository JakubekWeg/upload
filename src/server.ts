import express, { Request, Response } from "express";
import hbs from "express-handlebars";
import session from "express-session";
import {
  DEFAULT_ROOT_PASSWORD,
  HTTP_SERVER_PORT,
  STATIC_ASSETS_MAX_AGE,
} from "./configuration";
import { INSTANCE as db, initDatabase } from "./database";
import { init as initFilesRoutes } from "./files-route";
import { POST_DATA_HANDLER, withUser } from "./global";
import { init as initPreferencesRoutes } from "./preferences-route";
import { init as initTokenRoutes } from "./token-route";

(async () => {
  try {
    await initDatabase();
    console.log("Connected with database!");
  } catch (e) {
    console.error("Unable to connect to database:", e.message);
    return;
  }
  if (!db.hasUser("root")) {
    console.warn('Creating "root" user with password ' + DEFAULT_ROOT_PASSWORD);
    const root = await db.createUser("root", DEFAULT_ROOT_PASSWORD, 0, 0);
    root.isAdmin = true;
  }

  const app = express();
  app.enable("strict routing");
  app.use(
    session({
      name: "sid",
      secret: Array.from(new Array(16), () =>
        ((Math.random() * Math.pow(2, 31)) | 0).toString(16)
      ).join(""),
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        path: "/",
      },
    })
  );

  const FILE_SIZES_POSTFIXES = ["", "K", "M", "G", "T"];

  app.set("views", "./views");
  app.set("view engine", "hbs");
  app.engine(
    "hbs",
    hbs({
      defaultLayout: "main.hbs",
      extname: ".hbs",
      partialsDir: "./views/partials",
      helpers: {
        size: function (size: number): string {
          let index = 0;
          size = +size;
          while (size > 1024) {
            index += 1;
            size /= 1024;
          }
          return `${Math.round(size * 10) / 10}${FILE_SIZES_POSTFIXES[index]}B`;
        },
        areEqual: function (arg1: any, arg2: any, options: any) {
          return arg1 == arg2 ? options.fn(this) : options.inverse();
        },
      },
    })
  );

  app.listen(HTTP_SERVER_PORT, () =>
    console.log(`Server started at port ${HTTP_SERVER_PORT}!`)
  );

  app.get("/style.css", (_req, res) =>
    res.sendFile("style.css", {
      root: "./static",
      maxAge: STATIC_ASSETS_MAX_AGE,
    })
  );
  app.get("/font.ttf", (_req, res) =>
    res.sendFile("font.ttf", {
      root: "./static",
      maxAge: STATIC_ASSETS_MAX_AGE,
    })
  );
  app.get("/img/:name", (req, res) =>
    res.sendFile(req.params.name, {
      root: "./static/img",
      maxAge: STATIC_ASSETS_MAX_AGE,
    })
  );

  app.get("/", (req, res) => withUser(req, res, () => res.redirect("/files")));

  initFilesRoutes(app);
  initTokenRoutes(app);
  initPreferencesRoutes(app);

  app.get("/login", (_req, res) => res.redirect("/"));
  app.post("/login", POST_DATA_HANDLER, (req, res) =>
    withUser(
      req,
      res,
      () => res.redirect("/"),
      async () => {
        try {
          const user = await db.signInUserByPassword(
            req.body.login,
            req.body.password
          );
          if (req.session) {
            req.session.userId = user.uid;
            user.addActiveSession(req.session.id);
          }
          res.redirect("/");
        } catch (e) {
          res.status(401).render("error", {
            pageTitle: "Unable to sign you in",
            errorText: e.message,
            emoji: "🤐",
          });
        }
      }
    )
  );

  app.get("/logout", (req, res) => {
    if (req.session) {
      const sid = req.session.id;
      const uid = req.session.userId;
      req.session.destroy(async () => {
        const user = await db.getUser(uid);
        if (user) user.destroyActiveSession(sid);
        res.redirect("/");
      });
    }
  });

  app.get("*", (_req: Request, res: Response) =>
    res.status(404).render("error", {
      pageTitle: "Error 404: Site not found",
      errorText:
        "This page wasn't found on the server, u sure u typed right link?",
      emoji: "😕",
    })
  );

  // await db.close()
})();
