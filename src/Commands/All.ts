import type { CommandHandler, } from '../Command';

import Help from './Help';

export default new Map<string, CommandHandler>([
	[ "help", Help, ],
]);
