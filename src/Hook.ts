export function runHooks(hooks: Array<(...args: any[]) => boolean> | undefined, ...args: any[]): boolean {
	if (hooks) {
		for (const hook of hooks) {
			if (hook(...args)) return true;
		}
	}
	return false;
}
