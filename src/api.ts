import type { FolioApi } from './types';

const api = (window as unknown as { folio: FolioApi }).folio;

export default api;
