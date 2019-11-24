"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mysql = require("mysql");
class MySqlConnection {
    constructor(conn) {
        this.conn = conn;
    }
    static create(config) {
        return new Promise((resolve, reject) => {
            const conn = mysql.createConnection(config);
            conn.connect((err) => {
                if (err)
                    reject(err);
                else
                    resolve(new MySqlConnection(conn));
            });
        });
    }
    close() {
        return new Promise(((resolve, reject) => {
            this.conn.end(err => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        }));
    }
    query(sql, ...values) {
        return new Promise(((resolve, reject) => this.conn.query(sql, values, ((err, results) => {
            if (err)
                reject(err);
            else
                resolve(results);
        }))));
    }
}
exports.MySqlConnection = MySqlConnection;
