import type { CommandHandler, } from '../Command';

import Help from './Help';
import Test from './Test';

export { help, } from './Help';

export default new Map<string, CommandHandler>([
	[ "help", Help, ],
	[ "test", Test, ],
]);
