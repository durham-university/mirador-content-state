import mirador from 'mirador';
import config from './mirador-config';

import contentStatePlugin from './ContentStatePlugin';

const miradorInstance = mirador.viewer(config, [
  contentStatePlugin,
]);

export default miradorInstance;
