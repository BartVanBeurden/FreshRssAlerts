import svelte from 'rollup-plugin-svelte';
import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

const production = !process.env.ROLLUP_WATCH;

const targets = [{
	input: 'src/pages/options/index.js',
	output: 'build/pages/options/index.js'
}, {
	input: 'src/pages/popup/index.js',
	output: 'build/pages/popup/index.js'
}, {
	input: 'src/workers/index.js',
	output: 'build/workers/index.js'
}];

export default targets.map(target => { return {
	input: target.input,
	output: {
		file: target.output,
		minifyInternalExports: true,
		compact: true,
		format: 'cjs'
	},
	plugins: [
		svelte({
			emitCss: false,
			compilerOptions: {
				dev: !production
			}
		}),
		resolve(),
		commonjs(),
		json()
	],
	external: [
		'electron',
		'child_process',
		'process',
		'fs',
		'path',
		'url',
		'module',
		'os',
		'crypto'
	]
}; });
