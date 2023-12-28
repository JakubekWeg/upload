import sqlite3 from "sqlite3";

export class SqliteConnection {
  public static create(): Promise<SqliteConnection> {
    return new Promise<SqliteConnection>((resolve, reject) => {
      const db = new sqlite3.Database("/persistent/db.sqlite", (err) => {
        if (err) reject(err);
        else resolve(new SqliteConnection(db));
      });
    });
  }

  private constructor(private conn: sqlite3.Database) {}

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public query(sql: string, ...values: any): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) =>
      this.conn.all(sql, values, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      })
    );
  }
}
