import { User } from "./user";
import { generateRandomString } from "./global";

export class File {
    private static FILE_ID_CHARACTERS = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890'.split('')
    private static FILE_ID_LENGTH = 6

    public static generateFileId(): string {
        return generateRandomString(File.FILE_ID_LENGTH, File.FILE_ID_CHARACTERS)
    }


    public get downloadableName(): string {
        return this.name.endsWith(this.extension) ? this.name : (this.name + "." + this.extension)
    }


    constructor(
        public fid: string,
        public name: string,
        public type: string,
        public extension: string,
        public size: number,
        public createdDate: number,
        public isPublic: boolean,
        public owner: User) { }

    toJson(): any {
        return {
            name: this.name,
            type: this.type,
            extension: this.extension,
            size: +this.size,
            createdDate: +this.createdDate,
            isPublic: !!this.isPublic
        }
    }
}