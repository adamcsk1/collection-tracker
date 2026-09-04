import { ArgvModel } from './argv-model';

let _argv: ArgvModel | null = null;

export const getArgv = (): ArgvModel => {
  if (_argv) return _argv;

  const argv: ArgvModel = {
    dataFolder: '.data',
    debug: false,
    metadataServiceUrl: '',
  };

  for (const arg of process.argv) {
    if (arg.startsWith('--dataFolder=')) argv.dataFolder = arg.split('=')[1];
    if (arg.startsWith('--debug=')) argv.debug = arg.split('=')[1] === 'true';
    if (arg.startsWith('--metadataServiceUrl=')) argv.metadataServiceUrl = arg.slice('--metadataServiceUrl='.length);
  }

  return (_argv = argv);
};
