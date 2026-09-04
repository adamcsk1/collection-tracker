import { ArgvModel } from './argv-model';

let argv: ArgvModel | null = null;

export const getArgv = (): ArgvModel => {
  if (argv) return argv;

  const parsed: ArgvModel = {
    dataFolder: '.data',
    debug: false,
  };

  for (const arg of process.argv) {
    if (arg.startsWith('--dataFolder=')) parsed.dataFolder = arg.split('=')[1];
    if (arg.startsWith('--debug=')) parsed.debug = arg.split('=')[1] === 'true';
  }

  return (argv = parsed);
};
