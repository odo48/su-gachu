const BUCKET = 'exercise-images';

/** Public CDN URL for an exercise photo. `path` is an `exercises.images[]` entry. */
export function exerciseImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}
