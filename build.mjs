import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const jsConfig = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/app.bundle.js',
  sourcemap: true,
  logLevel: 'info',
};

const cssConfig = {
  entryPoints: ['styles.css'],
  bundle: false,
  minify: true,
  outfile: 'dist/styles.min.css',
  loader: { '.css': 'css' },
  logLevel: 'info',
};

if (watch) {
  const jsCtx = await esbuild.context(jsConfig);
  const cssCtx = await esbuild.context(cssConfig);
  await Promise.all([jsCtx.watch(), cssCtx.watch()]);
  console.log('esbuild: watching src/ and styles.css for changes...');
} else {
  await Promise.all([esbuild.build(jsConfig), esbuild.build(cssConfig)]);
  console.log('esbuild: built dist/app.bundle.js + dist/styles.min.css');
}
