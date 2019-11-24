import * as mysql from 'mysql'

export class MySqlConnection {
	public static create(config: mysql.ConnectionConfig): Promise<MySqlConnection> {
		return new Promise<MySqlConnection>((resolve, reject) => {
			const conn = mysql.createConnection(config)
			conn.connect((err) => {
				if (err)
					reject(err)
				else
					resolve(new MySqlConnection(conn))
			})
		})
	}

	private constructor(private conn: mysql.Connection) {
	}

	public close(): Promise<void> {
		return new Promise(((resolve, reject) => {
			this.conn.end(err => {
				if (err)
					reject(err)
				else
					resolve()
			})
		}))
	}

	public query(sql: string, ...values: any): Promise<any[]> {
		return new Promise<any[]>(((resolve, reject) =>
			this.conn.query(sql, values, ((err, results) => {
				if (err)
					reject(err)
				else
					resolve(results)
			}))))
	}

}
