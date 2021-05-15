import type * as Mongo from 'mongodb';

export class DBManager {
	protected db: Mongo.Db;
	public constructor(db: Mongo.Db) {
		this.db = db;
	}
}
