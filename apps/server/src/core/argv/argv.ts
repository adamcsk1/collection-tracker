import { ArgvModel } from '@server/core/argv/argv-model';

export const getArgv = () => {
  const argv: ArgvModel = {
    dataFolder: '.data',
    debug: false,
  };

  for (const arg of process.argv) {
    if (arg.startsWith('--dataFolder=')) argv.dataFolder = arg.split('=')[1];
    if (arg.startsWith('--debug=')) argv.debug = arg.split('=')[1] === 'true';
  }

  return argv;
};
