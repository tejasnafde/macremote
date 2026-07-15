// Vercel serverless function: receives design feedback from the selector page,
// files it as a GitHub issue comment (the agent polls that) and echoes it to
// Discord (so the user sees their submission was captured).
// Env (set via `vercel env`, never committed): GH_TOKEN, GH_REPO, GH_ISSUE,
// DISCORD_WEBHOOK_URL.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { action, kind, comments } = req.body ?? {};
  if (!action) return res.status(400).json({ error: "missing action" });

  const stamp = new Date().toISOString();
  const md = [
    `### Feedback${kind ? ` — ${kind}` : ""}`,
    ``,
    `- **at**: ${stamp}`,
    ``,
    comments ? comments : "_none_",
  ].join("\n");

  const results = { github: false, discord: false };

  try {
    const gh = await fetch(
      `https://api.github.com/repos/${process.env.GH_REPO}/issues/${process.env.GH_ISSUE}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: md }),
      }
    );
    results.github = gh.ok;
  } catch { /* recorded below */ }

  try {
    if (process.env.DISCORD_WEBHOOK_URL) {
      const dc = await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "macremote design",
          embeds: [{
            title: `Feedback received${kind ? ` (${kind})` : ""}`,
            description: comments ? comments.slice(0, 1800) : "_no comments_",
            color: 3447003,
          }],
        }),
      });
      results.discord = dc.ok;
    }
  } catch { /* non-fatal */ }

  if (!results.github) return res.status(502).json({ error: "failed to record feedback", results });
  return res.status(200).json({ ok: true, results });
}
