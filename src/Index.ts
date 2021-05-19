import * as Mongo from 'mongodb';
import * as Discord from 'discord.js';
import { config as loadEnv, } from 'dotenv';
import * as fs from 'fs';

import type { Schema, } from './ConfigParser';
import { parse as parseConfig, } from './ConfigParser';
import * as DB from './Database';
import * as MessageParser from './MessageParser';
import logging from './BasicLogging';

import commands from './Commands/All';

loadEnv();
const config: Schema = parseConfig(
	fs.existsSync('config.json')
		? JSON.parse(fs.readFileSync('config.json', { encoding: 'utf-8', }))
		: {}
);

const conn = new Mongo.MongoClient('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true, });
const discord = new Discord.Client();

if (!process.env.DISCORD_TOKEN) {
	logging.error('Missing required environment variable: DISCORD_TOKEN');
	process.exit(1);
}

(async (): Promise<void> => {
	await conn.connect();
	logging.log('DB connection established.');
	await discord.login(process.env.DISCORD_TOKEN);
	logging.log('Discord connection established.');
	logging.info('Starting bot...');
	main(new MessageParser.MessageParser(config, new DB.DBManager(conn.db(config.dbName)), discord, commands), discord);
})().catch(e => { throw e; });

function main(messageParser: MessageParser.MessageParser, bot: Discord.Client): void {
	bot.on('message', message => {
		if (runHooks(hooks.beforeProcess, message)) return;
		if (message.author.id !== (bot.user as Discord.ClientUser).id) { // prevent infinite recursion
			try {
				if (runHooks(hooks.beforeParse, message)) return;
				messageParser.run(message, bot);
			} catch (e) {
				if (runHooks(hooks.onParseThrow, message, e)) return;
				console.error('While handling message:', e);
			}
		}
	});
	hooks._internal?.forEach((fns, event) => {
		fns.forEach(fn => {
			bot.on(event, fn);
		});
	});
}
