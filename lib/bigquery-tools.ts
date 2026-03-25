import { BigQuery } from "@google-cloud/bigquery";
import { tool } from "ai";
import path from "path";
import { z } from "zod";

const bigquery = new BigQuery({
  keyFilename: path.join(process.cwd(), "google-config.json"),
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

export const bigqueryTools = {
  query: tool({
    description:
      "Execute a read-only BigQuery SQL query and return results. Only SELECT statements are allowed. Use backtick-quoted full table paths like `project.dataset.table`.",
    parameters: z.object({
      query: z
        .string()
        .describe("The SQL SELECT query to execute."),
      maxResults: z
        .number()
        .optional()
        .describe("Maximum rows to return (default 500)."),
    }),
    execute: async ({ query, maxResults = 500 }) => {
      const trimmed = query.trim().toLowerCase();
      if (!trimmed.startsWith("select")) {
        return { error: "Only SELECT queries are allowed." };
      }
      try {
        const [rows] = await bigquery.query({ query, maxResults });
        return { rows, rowCount: rows.length };
      } catch (e: any) {
        return { error: e.message };
      }
    },
  }),

  dry_run_query: tool({
    description:
      "Validate a SQL query and estimate its processing cost without executing it. Use this before running expensive queries.",
    parameters: z.object({
      query: z.string().describe("The SQL query to validate."),
    }),
    execute: async ({ query }) => {
      try {
        const [job] = await bigquery.createQueryJob({ query, dryRun: true });
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
      } catch (e: any) {
        return { valid: false, error: e.message };
      }
    },
  }),

  list_all_datasets: tool({
    description:
      "List all available BigQuery datasets in the configured project.",
    parameters: z.object({}),
    execute: async () => {
      try {
        const [datasets] = await bigquery.getDatasets();
        return { datasets: datasets.map((d) => d.id) };
      } catch (e: any) {
        return { error: e.message };
      }
    },
  }),

  list_all_tables_with_dataset: tool({
    description:
      "List all tables in a BigQuery dataset, including their schemas, types and descriptions.",
    parameters: z.object({
      datasetId: z.string().describe("The dataset ID to inspect."),
    }),
    execute: async ({ datasetId }) => {
      try {
        const [tables] = await bigquery.dataset(datasetId).getTables();
        const tableInfos = await Promise.all(
          tables.map(async (table) => {
            const [meta] = await table.getMetadata();
            return {
              tableId: table.id,
              description: meta.description ?? "",
              timePartitioning: meta.timePartitioning ?? null,
              schema:
                meta.schema?.fields?.map((f: any) => ({
                  name: f.name,
                  type: f.type,
                  mode: f.mode,
                  description: f.description ?? "",
                })) ?? [],
            };
          }),
        );
        return { datasetId, tables: tableInfos };
      } catch (e: any) {
        return { error: e.message };
      }
    },
  }),

  get_table_information: tool({
    description:
      "Get schema and up to 20 sample rows from a specific BigQuery table. For partitioned tables, provide a partition value to avoid full scans.",
    parameters: z.object({
      datasetId: z.string().describe("The dataset ID."),
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
        const table = bigquery.dataset(datasetId).table(tableId);
        const [meta] = await table.getMetadata();
        const projectId = meta.tableReference?.projectId;
        const schema =
          meta.schema?.fields?.map((f: any) => ({
            name: f.name,
            type: f.type,
            mode: f.mode,
            description: f.description ?? "",
          })) ?? [];

        let sampleQuery = `SELECT * FROM \`${projectId}.${datasetId}.${tableId}\``;
        if (partition && meta.timePartitioning) {
          const partitionField =
            meta.timePartitioning.field ?? "_PARTITIONTIME";
          sampleQuery += ` WHERE DATE(${partitionField}) = '${partition}'`;
        }
        sampleQuery += " LIMIT 20";

        const [rows] = await bigquery.query({ query: sampleQuery });
        return { schema, sampleRows: rows };
      } catch (e: any) {
        return { error: e.message };
      }
    },
  }),
};
