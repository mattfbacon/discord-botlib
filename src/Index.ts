import * as Discord from 'discord.js';
import { config as loadEnv, } from 'dotenv';

import DBManager from './Database';
import * as MessageParser from './MessageParser';
import logging from './BasicLogging';

import commands from './Commands/All';
import hooks from './Hooks/All';
import { runHooks, } from './Hook';

loadEnv();

const discord = new Discord.Client({
	intents: [Discord.Intents.FLAGS.GUILD_MESSAGES],
});

if (!process.env.DISCORD_TOKEN) {
	logging.error('Missing required environment variable: DISCORD_TOKEN');
	process.exit(1);
}

(async (): Promise<void> => {
	const db = new DBManager();
	await Promise.all([
		db.connect().then(() => { logging.log('DB connection established.'); }),
		discord.login(process.env.DISCORD_TOKEN).then(() => { logging.log('Discord connection established.'); }),
	]);
	logging.info('Starting bot...');
	main(new MessageParser.MessageParser(db, discord, commands), discord);
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
