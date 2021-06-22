import mirador from 'mirador';

import contentStatePlugin from './ContentStatePlugin';

const miradorInstance = mirador.viewer(
  {
    id: 'root',
    contentState: true,
  }, 
  [
    contentStatePlugin,
  ]
);

export default miradorInstance;
