// Lazy scheduled publishing.
// Cloudflare Pages has no cron trigger in this project, so instead of a
// scheduled job we flip any due 'scheduled' posts to 'published' on the fly,
// at the start of public reads. Errors are swallowed: a failed flip must
// never break a public page — the post simply appears on a later request.

export async function publishDue(DB) {
  try {
    await DB.prepare(
      "UPDATE news SET status = 'published' WHERE status = 'scheduled' AND published_at <= datetime('now')"
    ).run();
  } catch {
    /* ignore — see note above */
  }
}
