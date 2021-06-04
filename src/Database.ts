import * as MariaDB from 'mariadb';
import * as Sequelize from 'sequelize';
import logging from './BasicLogging';

import config from './Config';


export interface IDBManager {
	readonly isConnected: boolean;
	connect: () => Promise<void>;
}

class DBManager implements IDBManager {
	protected readonly conn: Sequelize.Sequelize;
	protected _isConnected = false;

	public constructor() {
		if (!('DB_USERNAME' in process.env)) {
			throw new TypeError('DB_USERNAME required but not provided');
		}
		if (!('DB_PASSWORD' in process.env)) {
			throw new TypeError('DB_PASSWORD required but not provided');
		}
		this.conn = new Sequelize.Sequelize(
			config.dbName,
			process.env.DB_USERNAME as string,
			process.env.DB_PASSWORD as string,
			{
				dialect: 'mariadb',
				dialectOptions: { connectTimeout: 1000, }, // 1 second
				database: config.dbName,
				logging: logging.log,
			},
		);
	}

	public async connect(): Promise<void> {
		if (this._isConnected) return;
		try {
			await this.conn.authenticate();
		} catch (e) {
			if (e instanceof Sequelize.ConnectionError && e.original instanceof MariaDB.SqlError && e.original.code === 'ER_BAD_DB_ERROR') {
				const tempConn = await MariaDB.createConnection({ user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, });
				await tempConn.query(`create database ${config.dbName} character set = utf8mb4 collate = utf8mb4_unicode_ci`); // no other way and this is internal
				await tempConn.end();
				await this.conn.authenticate(); // try again now that the DB exists
			} else {
				throw e;
			}
		}
		await this.conn.sync();
		this._isConnected = true;
	}

	public get isConnected(): boolean {
		return this._isConnected;
	}
}

export default DBManager;
