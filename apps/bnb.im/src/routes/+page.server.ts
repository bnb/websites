import { indexRows } from '$lib/rows';
import { loadPosts } from '$lib/server/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ rows: indexRows(loadPosts()) });
