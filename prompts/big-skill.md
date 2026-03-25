---
name: solvely-bq
description: Query Solvely data in BigQuery across analytics events, user data, orders, subscriptions, Stripe data, experiments, and invitation records. Use this skill whenever the user asks about Solvely metrics, user behavior, subscription data, payment information, analytics events, A/B tests, or any data analysis related to the Solvely platform. Trigger on mentions of "events", "users", "订阅", "订单", "埋点", "数据", "查询", "stripe", "实验组", or any data exploration requests.
---

# Solvely BigQuery Data Query Skill

This skill helps you query and analyze data from the Solvely platform stored in BigQuery. All queries default to UTC+8 (China timezone).

## Timezone Configuration

**ALWAYS use UTC+8 timezone** for all date/time operations:

```sql
-- Convert timestamps to UTC+8
TIMESTAMP_ADD(your_timestamp, INTERVAL 8 HOUR)

-- For date filtering with 'today'
DATE(TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR))
```

## Database Schema Overview

### 1. Analytics Events (埋点、事件)

Track user behavior and analytics events.

**Dataset**: `solvely-a3b82.analytics_365900100`
**Table Pattern**: `events_intraday_*` (wildcard tables for daily partitions)
**Default Time Range**: today

**Common Query Pattern**:

```sql
SELECT
  event_name,
  user_pseudo_id,
  event_timestamp,
  event_params
FROM `solvely-a3b82.analytics_365900100.events_intraday_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', DATE(TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)))
```

**Period Values** (used in event_params or filters):

- `1` = 1 month
- `3` = 3 months
- `7` = 7 days
- `12` = 12 months

### 2. Business Data (订单、订阅、产品、用户)

Core business tables from MySQL migration.

**Dataset**: `biblia-sagrada-consigo.solvely_mysql_migration`

**Tables**:

- `userInfo` - User information
- `orderWeb` - Order records
- `subscription` - Subscription records
- `productWeb` - Product and pricing information

**Default Time Range**: today

**Common Query Pattern**:

```sql
-- Example: Query today's orders
SELECT
  order_id,
  user_id,
  product_id,
  created_at
FROM `biblia-sagrada-consigo.solvely_mysql_migration.orderWeb`
WHERE DATE(created_at) = DATE(TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR))
```

### 3. Experiment Groups (实验组)

A/B test and experiment data.

**Dataset**: `biblia-sagrada-consigo.Solvely`
**Table**: `us_web_user`

**Common Query Pattern**:

```sql
SELECT
  user_id,
  experiment_group,
  variant
FROM `biblia-sagrada-consigo.Solvely.us_web_user`
WHERE experiment_id = 'your_experiment_id'
```

### 4. Stripe Payment Data

Two sets of Stripe tables: **new** (current) and **old** (legacy).

**Dataset**: `solvely-warehouse.staging`

#### New Stripe Tables (优先使用)

- `staging_stripe_new_subscriptions_phi` - Subscription records
- `staging_stripe_new_subscription_items_phi` - Subscription line items
- `staging_stripe_new_invoices_phi` - Invoice records
- `staging_stripe_new_customers_phi` - Customer information
- `staging_stripe_new_charges_phi` - Payment charges

#### Old Stripe Tables (Legacy)

- `staging_stripe_subscriptions_phi` - Legacy subscriptions
- `staging_stripe_subscription_items_phi` - Legacy subscription items
- `staging_stripe_invoices_phi` - Legacy invoices
- `staging_stripe_customers_phi` - Legacy customers
- `staging_stripe_charges_phi` - Legacy charges

**When to use which**: Default to **new** tables unless specifically asked about historical data or if the new tables don't contain the needed records.

**Common Query Pattern**:

```sql
-- Example: Active subscriptions with customer info
SELECT
  s.id as subscription_id,
  s.customer_id,
  c.email,
  s.status,
  s.current_period_start,
  s.current_period_end
FROM `solvely-warehouse.staging.staging_stripe_new_subscriptions_phi` s
JOIN `solvely-warehouse.staging.staging_stripe_new_customers_phi` c
  ON s.customer_id = c.id
WHERE s.status = 'active'
```

### 5. Invitation Records (邀请记录)

Track referral and invitation data.

**Dataset**: `solvely-warehouse.dwd`

**Tables**:

- `dwd_solvely_activity_invitatio` - Inviters and invitation codes (邀请人/邀请码)
- `dwd_solvely_invitation_record` - Invitees and invitation records (被邀请人/邀请记录)

**Common Query Pattern**:

```sql
-- Example: Invitation funnel
SELECT
  i.inviter_id,
  i.invitation_code,
  COUNT(r.invitee_id) as total_invitations,
  SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) as completed_invitations
FROM `solvely-warehouse.dwd.dwd_solvely_activity_invitatio` i
LEFT JOIN `solvely-warehouse.dwd.dwd_solvely_invitation_record` r
  ON i.invitation_code = r.invitation_code
GROUP BY i.inviter_id, i.invitation_code
```

## Query Patterns and Best Practices

### Time Filtering

When the user mentions "today", "this week", or relative dates, always apply UTC+8 timezone:

```sql
-- Today
WHERE DATE(your_timestamp) = DATE(TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR))

-- This week
WHERE DATE(your_timestamp) >= DATE_SUB(
  DATE(TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)),
  INTERVAL 7 DAY
)

-- This month
WHERE DATE(your_timestamp) >= DATE_TRUNC(
  DATE(TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)),
  MONTH
)
```

### Wildcard Tables

For event tables using `_*` suffix, use `_TABLE_SUFFIX` to filter dates:

```sql
-- Last 7 days of events
FROM `solvely-a3b82.analytics_365900100.events_intraday_*`
WHERE _TABLE_SUFFIX BETWEEN
  FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
```

### Joining Across Datasets

Combine data from different sources to get complete insights:

```sql
-- Example: Users with their subscription status
SELECT
  u.user_id,
  u.email,
  s.status as subscription_status,
  s.current_period_end
FROM `biblia-sagrada-consigo.solvely_mysql_migration.userInfo` u
LEFT JOIN `solvely-warehouse.staging.staging_stripe_new_subscriptions_phi` s
  ON u.stripe_customer_id = s.customer_id
```

## Common Use Cases

### 1. Daily Active Users

```sql
SELECT
  COUNT(DISTINCT user_pseudo_id) as dau
FROM `solvely-a3b82.analytics_365900100.events_intraday_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE())
```

### 2. Subscription Revenue Analysis

```sql
SELECT
  DATE(created) as date,
  COUNT(*) as new_subscriptions,
  SUM(plan_amount) as revenue
FROM `solvely-warehouse.staging.staging_stripe_new_subscriptions_phi`
WHERE status IN ('active', 'trialing')
GROUP BY date
ORDER BY date DESC
```

### 3. Experiment Performance

```sql
-- Compare conversion rates across experiment groups
SELECT
  e.variant,
  COUNT(DISTINCT e.user_id) as users,
  COUNT(DISTINCT s.customer_id) as converted_users,
  SAFE_DIVIDE(COUNT(DISTINCT s.customer_id), COUNT(DISTINCT e.user_id)) as conversion_rate
FROM `biblia-sagrada-consigo.Solvely.us_web_user` e
LEFT JOIN `solvely-warehouse.staging.staging_stripe_new_subscriptions_phi` s
  ON e.stripe_customer_id = s.customer_id
GROUP BY e.variant
```

### 4. Invitation Effectiveness

```sql
SELECT
  i.invitation_code,
  COUNT(r.invitee_id) as invitations_sent,
  SUM(CASE WHEN r.converted = true THEN 1 ELSE 0 END) as conversions,
  SAFE_DIVIDE(
    SUM(CASE WHEN r.converted = true THEN 1 ELSE 0 END),
    COUNT(r.invitee_id)
  ) as conversion_rate
FROM `solvely-warehouse.dwd.dwd_solvely_activity_invitatio` i
LEFT JOIN `solvely-warehouse.dwd.dwd_solvely_invitation_record` r
  ON i.invitation_code = r.invitation_code
GROUP BY i.invitation_code
```

## Workflow

When the user asks for data:

1. **Identify the data source(s)** - Which dataset/tables contain the needed data?
2. **Apply timezone** - Use UTC+8 for all date/time operations
3. **Build the query** - Start with the main table, add JOINs if needed
4. **Add filters** - Apply time ranges, status filters, etc.
5. **Execute using mcp**bigquery**query** - Run the query
6. **Present results** - Format the output clearly for the user

## Tips

- **Always check table existence first** if unsure - use `mcp__bigquery__list_all_tables_with_dataset`
- **Use dry run** for complex queries - use `mcp__bigquery__dry_run_query` to check syntax and estimate cost
- **Limit results** - Add `LIMIT 100` to exploratory queries to avoid huge result sets
- **Prefer new Stripe tables** - Unless specifically asked for historical data
- **Join carefully** - Understand the relationship between tables before joining
- **Handle NULLs** - Use `COALESCE()` or `IFNULL()` for robust queries

## Example Conversations

**User**: "今天有多少订单？"

You should:

1. Identify table: `biblia-sagrada-consigo.solvely_mysql_migration.orderWeb`
2. Apply UTC+8 timezone for "今天"
3. Query and return the count

**User**: "查一下上周新增的活跃订阅用户"

You should:

1. Identify tables: `staging_stripe_new_subscriptions_phi`
2. Filter: `status = 'active'` AND created in last week (UTC+8)
3. Join with customers if email/name needed
4. Return the list

**User**: "对比一下实验组 A 和 B 的转化率"

You should:

1. Identify tables: `us_web_user` (experiments) + `staging_stripe_new_subscriptions_phi` (conversions)
2. Group by variant
3. Calculate conversion rates
4. Present comparison

---

Remember: This skill is about understanding what data the user needs and crafting the right BigQuery SQL to get it. Think about what tables to use, how to join them, and what filters to apply. Always use UTC+8 timezone and prefer new Stripe tables over old ones.
