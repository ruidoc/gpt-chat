import { BigQuery } from "@google-cloud/bigquery";
import { tool } from "ai";
import path from "path";
import { z } from "zod";

const bigquery = new BigQuery({
  keyFilename: path.join(process.cwd(), "google-config.json"),
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const runBigQuerySqlParameters = z.object({
  sql: z
    .string()
    .optional()
    .describe(
      "Read-only BigQuery SELECT. **Always use this key** for the SQL string.",
    ),
  query: z
    .string()
    .optional()
    .describe(
      "Do not use. If the model mistakenly sends SQL here (old habit), the server merges it into `sql`.",
    ),
  maxResults: z
    .number()
    .optional()
    .describe("Maximum rows to return (default 500)."),
});

const dryRunBigQuerySqlParameters = z.object({
  sql: z.string().optional().describe("SQL to dry-run. **Always use this key**."),
  query: z
    .string()
    .optional()
    .describe(
      "Do not use; merged into `sql` only if `sql` is empty (legacy mistaken key).",
    ),
});

export const bigqueryTools = {
  run_bigquery_sql: tool({
    description:
      "Execute a read-only BigQuery SELECT and return rows. Only SELECT is allowed. Use backtick-quoted tables like `project.dataset.table`. You MUST pass the statement in the `sql` argument (string).",
    inputSchema: runBigQuerySqlParameters,
    execute: async ({ sql, query: queryField, maxResults = 500 }) => {
      const statement = (sql ?? queryField ?? "").trim();
      if (!statement) {
        return {
          error:
            "Missing SQL: set the `sql` parameter to your SELECT string (do not use `query` as the key).",
        };
      }
      const lowered = statement.toLowerCase();
      if (!lowered.startsWith("select")) {
        return { error: "Only SELECT queries are allowed." };
      }
      try {
        const [rows] = await bigquery.query({ query: statement, maxResults });
        return { rows, rowCount: rows.length };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),

  dry_run_bigquery_sql: tool({
    description:
      "Validate a BigQuery SQL statement and estimate bytes/cost without executing it. Use before expensive queries. Pass SQL in the `sql` argument.",
    inputSchema: dryRunBigQuerySqlParameters,
    execute: async ({ sql, query: queryField }) => {
      const statement = (sql ?? queryField ?? "").trim();
      if (!statement) {
        return {
          valid: false,
          error:
            "Missing SQL: set the `sql` parameter (do not use `query` as the key).",
        };
      }
      try {
        const [job] = await bigquery.createQueryJob({
          query: statement,
          dryRun: true,
        });
        const bytes = parseInt(
          job.metadata?.statistics?.totalBytesProcessed ?? "0",
        );
        const gb = bytes / 1e9;
        return {
          valid: true,
          bytesProcessed: bytes,
          gigabytesProcessed: gb.toFixed(3),
          estimatedCostUSD: (gb * 0.005).toFixed(4),
        };
      } catch (e: unknown) {
        return { valid: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),

  list_all_datasets: tool({
    description:
      "List all available BigQuery datasets in the configured project.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const [datasets] = await bigquery.getDatasets();
        return { datasets: datasets.map((d) => d.id) };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),

  list_all_tables_with_dataset: tool({
    description:
      "List all tables in a BigQuery dataset, including their schemas, types and descriptions. datasetId can be 'project.dataset' or just 'dataset'.",
    inputSchema: z.object({
      datasetId: z
        .string()
        .describe("The dataset ID to inspect. Supports 'project.dataset' or just 'dataset'."),
    }),
    execute: async ({ datasetId }) => {
      try {
        let projectOverride: string | undefined;
        let actualDatasetId = datasetId;
        if (datasetId.includes(".")) {
          const parts = datasetId.split(".");
          projectOverride = parts[0];
          actualDatasetId = parts[1];
        }
        const dataset = projectOverride
          ? bigquery.dataset(actualDatasetId, { projectId: projectOverride })
          : bigquery.dataset(actualDatasetId);
        const [tables] = await dataset.getTables();
        const tableInfos = await Promise.all(
          tables.map(async (table) => {
            const [meta] = await table.getMetadata();
            return {
              tableId: table.id,
              description: meta.description ?? "",
              timePartitioning: meta.timePartitioning ?? null,
              schema:
                meta.schema?.fields?.map((f: Record<string, unknown>) => ({
                  name: f.name as string,
                  type: f.type as string,
                  mode: f.mode as string,
                  description: (f.description as string) ?? "",
                })) ?? [],
            };
          }),
        );
        return { datasetId: actualDatasetId, tables: tableInfos };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),

  get_table_information: tool({
    description:
      "Get schema and up to 20 sample rows from a specific BigQuery table. For partitioned tables, provide a partition value to avoid full scans.",
    inputSchema: z.object({
      datasetId: z
        .string()
        .describe("The dataset ID. Supports 'project.dataset' or just 'dataset'."),
      tableId: z.string().describe("The table ID."),
      partition: z
        .string()
        .optional()
        .describe(
          "Optional partition value (e.g. '20250101' for date-partitioned tables).",
        ),
    }),
    execute: async ({ datasetId, tableId, partition }) => {
      try {
        let projectOverride: string | undefined;
        let actualDatasetId = datasetId;
        if (datasetId.includes(".")) {
          const parts = datasetId.split(".");
          projectOverride = parts[0];
          actualDatasetId = parts[1];
        }
        const dataset = projectOverride
          ? bigquery.dataset(actualDatasetId, { projectId: projectOverride })
          : bigquery.dataset(actualDatasetId);
        const table = dataset.table(tableId);
        const [meta] = await table.getMetadata();
        const resolvedProjectId =
          projectOverride ?? meta.tableReference?.projectId;
        const schema =
          meta.schema?.fields?.map((f: Record<string, unknown>) => ({
            name: f.name as string,
            type: f.type as string,
            mode: f.mode as string,
            description: (f.description as string) ?? "",
          })) ?? [];

        let sampleQuery = `SELECT * FROM \`${resolvedProjectId}.${actualDatasetId}.${tableId}\``;
        if (partition && meta.timePartitioning) {
          const partitionField =
            meta.timePartitioning.field ?? "_PARTITIONTIME";
          sampleQuery += ` WHERE DATE(${partitionField}) = '${partition}'`;
        }
        sampleQuery += " LIMIT 20";

        const [rows] = await bigquery.query({ query: sampleQuery });
        return { schema, sampleRows: rows };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),
};
