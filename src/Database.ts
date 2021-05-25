import * as MariaDB from 'mariadb';
import * as Mongo from 'mongodb';
import * as Sequelize from 'sequelize';
import logging from './BasicLogging';

import config from './Config';

export type MongoDoc<T> = T & { _id: Mongo.ObjectId };

export abstract class DBManager {
	public abstract readonly isConnected: boolean;
	public abstract connect(): Promise<void>;
}

class MongoDBManager extends DBManager {
	protected conn: Mongo.MongoClient;
	protected db: Mongo.Db = null as unknown as Mongo.Db; // will be reassigned
	public constructor() {
		super();
		this.conn = new Mongo.MongoClient('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true, });
	}

	public async connect(): Promise<void> {
		await this.conn.connect();
		this.db = this.conn.db(config.dbName);
	}

	public get isConnected(): boolean {
		return this.conn.isConnected();
	}
}

class SQLDBManager extends DBManager {
	protected readonly conn: Sequelize.Sequelize;
	protected _isConnected = false;

	public constructor() {
		super();
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
			}
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
		await this.conn.sync({ alter: true, });
		this._isConnected = true;
	}

	public get isConnected(): boolean {
		return this._isConnected;
	}
}

// select your preferred database here
export default SQLDBManager;
