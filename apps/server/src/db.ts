import { PGlite } from "@electric-sql/pglite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS goals (
  id          text PRIMARY KEY,
  revision    integer NOT NULL DEFAULT 1,
  repo_path   text NOT NULL,
  goal_text   text NOT NULL,
  boundary    jsonb NOT NULL,
  status      text NOT NULL,
  outcome     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  id            text PRIMARY KEY,
  goal_id       text NOT NULL REFERENCES goals(id),
  status        text NOT NULL,
  worktree_path text,
  branch        text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

CREATE TABLE IF NOT EXISTS candidates (
  id          text PRIMARY KEY,
  run_id      text NOT NULL REFERENCES runs(id),
  goal_id     text NOT NULL REFERENCES goals(id),
  branch      text NOT NULL,
  base_commit text NOT NULL,
  head_commit text NOT NULL,
  diff_stat   text NOT NULL,
  patch       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessments (
  id           text PRIMARY KEY,
  candidate_id text NOT NULL REFERENCES candidates(id),
  goal_id      text NOT NULL REFERENCES goals(id),
  verdict      text NOT NULL,
  evidence     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id         serial PRIMARY KEY,
  goal_id    text NOT NULL REFERENCES goals(id),
  kind       text NOT NULL,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

export type DB = PGlite;

/** dataDir 省略时为内存库（测试用）。 */
export async function openDb(dataDir?: string): Promise<DB> {
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.exec(SCHEMA);
  return db;
}
