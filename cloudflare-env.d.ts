declare module 'cloudflare:workers' {
  const env: { DB?: import('./db/poems').Database; BUCKET?: import('./db/images').ImageBucket };
  export { env };
}
