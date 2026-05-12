// Actor picker — debounced TMDB type-ahead search.
// Mounted by play.js when the setter is choosing actors A and B.
//
// STUB — implementation deferred to Phase 3.

import { searchPeople } from '../api/tmdb.js';
import { debounce } from '../utils/debounce.js';
import { SEARCH_DEBOUNCE_MS, IMAGE_BASE } from '../config/constants.js';

export function mountPicker(/* { hostEl, onPick } */) {
  // TODO: render a search input + result list, call onPick({ id, name, profile_path })
  void searchPeople; void debounce; void SEARCH_DEBOUNCE_MS; void IMAGE_BASE;
}
