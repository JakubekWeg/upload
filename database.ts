import { readFileSync, writeFile, existsSync, mkdirSync } from "fs";
import { User } from "./user";
import { File } from "./file";
import { TMP_UPLOADS_FOLDER, UPLOADS_FOLDER } from "./configuration";



export class Database {
    private static CORRECT_USER_NAME_REGEX = /^[a-z0-9-_\.]{3,50}$/
    private USERS: Map<string, User> = new Map()
    // fuid : uuid
    private FILE_OWNERSHIPS: Map<string, string> = new Map()
    // code : uuid
    private UPLOAD_CODES: Map<string, string> = new Map()

    constructor(private filename: string) {
        INSTANCE = this
        try {
            if (existsSync(filename)) {
                const config = JSON.parse(readFileSync(filename, { encoding: 'utf8' }));

                for (const uid in config.users) {
                    const user = config.users[uid]
                    this.USERS.set(uid.toLowerCase(),
                        new User(uid, user.password, +user.quota, user.files))
                }
                for (const fid in config.fileOwnerships) {
                    if (this.USERS.has(config.fileOwnerships[fid]))
                        this.FILE_OWNERSHIPS.set(fid, config.fileOwnerships[fid])
                }
            }
        } catch (error) {
            console.error('Unable to read configuration:', error);
            throw error
        }
    }

    save() {
        const users = {}
        this.USERS.forEach((u, uid) => {
            Object.assign(users, { [uid]: u.toJson() })
        })


        const ownerships = {}
        this.FILE_OWNERSHIPS.forEach((u, fid) => {
            Object.assign(ownerships, { [fid]: u })
        })

        writeFile(this.filename, JSON.stringify({
            users: users,
            fileOwnerships: ownerships
        }), { encoding: 'utf8' }, () => {
            console.log('Saved database!');
        })
    }

    createUser(name: string, password: string, quota: number) {
        if (!name)
            throw new Error('Missing user name')
        name = name.toLowerCase()
        if (!!this.USERS.get(name))
            throw new Error('User with this name already exists!')

        if (!Database.CORRECT_USER_NAME_REGEX.test(name))
            throw new Error('User name contains not allowed characters!')

        if (!password) throw new Error('Invalid password')

        console.log(`User ${name} created!`);

        this.USERS.set(name, new User(name, password, +quota, {}))
        this.save()
    }


    signInUser(login: string, password: string): User {
        if (login && password) {
            const user = this.USERS.get(login.toLowerCase())
            if (user) {
                if (user.password === password) {
                    return user
                }
            }
        }
        throw new Error('Invalid password or username')
    }

    registerNewFile(uid: string): string {
        const fid = File.generateFileId()
        if (this.FILE_OWNERSHIPS.has(fid))
            return this.registerNewFile(uid)

        this.FILE_OWNERSHIPS.set(fid, uid)
        return fid;
    }

    getFileById(fid: string): File | undefined {
        const uid = this.FILE_OWNERSHIPS.get(fid)
        if (uid) {
            const user = this.USERS.get(uid)
            if (user)
                return user.fileById(fid)
        }
    }

    unregisterFile(fid: string) {
        this.FILE_OWNERSHIPS.delete(fid)
    }


    getUserByName(name: string): User | undefined {
        if (name) {
            name = name.toLowerCase()
            return this.USERS.get(name)
        }
    }

    registerNewUploadCode(uid: string): string {
        uid = uid.toLowerCase()
        const user = this.getUserByName(uid)
        if (!user) throw new Error('User not found!')
        const code = User.generateUploadCode()
        if (this.UPLOAD_CODES.has(code))
            return this.registerNewUploadCode(uid)

        this.UPLOAD_CODES.set(code, uid)

        return code
    }

    unregisterUploadCode(code: string) {
        this.UPLOAD_CODES.delete(code)
    }

    getUserByUploadCode(code: string): User | undefined {
        const uid = this.UPLOAD_CODES.get(code)

        if (uid) {
            const user = this.USERS.get(uid)
            if (user) {
                if (user.currentUploadCode === code)
                    return user
            }
        }
    }
}


export function initDatabase(filename: string) {
    INSTANCE = new Database(filename)
}
export let INSTANCE: Database